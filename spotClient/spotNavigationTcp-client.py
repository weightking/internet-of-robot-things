# Copyright (c) 2021 Boston Dynamics, Inc.  All rights reserved.
#
# Downloading, reproducing, distributing or otherwise using the SDK Software
# is subject to the terms and conditions of the Boston Dynamics Software
# Development Kit License (20191101-BDSDK-SL).

"""Command line interface for graph nav with options to download/upload a map and to navigate a map. """

import argparse
import grpc
import logging
import math
import os
import sys
import time
import socket
import json

from bosdyn.api import geometry_pb2
from bosdyn.api import power_pb2
from bosdyn.api import robot_state_pb2
from bosdyn.api.graph_nav import graph_nav_pb2
from bosdyn.api.graph_nav import map_pb2
from bosdyn.api.graph_nav import nav_pb2
import bosdyn.client.channel
from bosdyn.client.power import safe_power_off, PowerClient, power_on
from bosdyn.client.exceptions import ResponseError
from bosdyn.client.graph_nav import GraphNavClient
from bosdyn.client.frame_helpers import get_odom_tform_body
from bosdyn.client.lease import LeaseClient, LeaseKeepAlive, LeaseWallet
from bosdyn.client.math_helpers import Quat, SE3Pose
from bosdyn.client.robot_command import RobotCommandClient, RobotCommandBuilder
from bosdyn.client.robot_state import RobotStateClient
import bosdyn.client.util
from bosdyn.client.estop import EstopClient, EstopEndpoint, EstopKeepAlive
from bosdyn.client.robot_command import RobotCommandBuilder, RobotCommandClient, blocking_stand
from bosdyn.client.recording import GraphNavRecordingServiceClient
from bosdyn.api.graph_nav import map_pb2, recording_pb2
import google.protobuf.timestamp_pb2

import graph_nav_util


class GraphNavInterface(object):
    """GraphNav service command line interface."""

    def __init__(self, robot, upload_path):
        self._VELOCITY_BASE_SPEED = 0.5
        self._VELOCITY_BASE_ANGULAR = 0.8
        self._VELOCITY_CMD_DURATION = 0.6

        self._robot = robot

        # Force trigger timesync.
        self._robot.time_sync.wait_for_sync()

        # Create the lease client with keep-alive, then acquire the lease.
        self._lease_client = self._robot.ensure_client(LeaseClient.default_service_name)
        self._lease_wallet = self._lease_client.lease_wallet
        self._lease = self._lease_client.acquire()
        self._lease_keepalive = LeaseKeepAlive(self._lease_client)

        # Create robot state and command clients.
        self._robot_command_client = self._robot.ensure_client(
            RobotCommandClient.default_service_name)
        self._robot_state_client = self._robot.ensure_client(RobotStateClient.default_service_name)

        # Create the client for the Graph Nav main service.
        self._graph_nav_client = self._robot.ensure_client(GraphNavClient.default_service_name)

        # Create a power client for the robot.
        self._power_client = self._robot.ensure_client(PowerClient.default_service_name)

        # Boolean indicating the robot's power state.
        power_state = self._robot_state_client.get_robot_state().power_state
        self._started_powered_on = (power_state.motor_power_state == power_state.STATE_ON)
        self._powered_on = self._started_powered_on

        # Number of attempts to wait before trying to re-power on.
        self._max_attempts_to_wait = 50

        # Store the most recent knowledge of the state of the robot based on rpc calls.
        self._current_graph = None
        self._current_edges = dict()  #maps to_waypoint to list(from_waypoint)
        self._current_waypoint_snapshots = dict()  # maps id to waypoint snapshot
        self._current_edge_snapshots = dict()  # maps id to edge snapshot
        self._current_annotation_name_to_wp_id = dict()

        # Filepath for uploading a saved graph's and snapshots too.
        if upload_path[-1] == "/":
            self._upload_filepath = upload_path[:-1]
        else:
            self._upload_filepath = upload_path

        # Setup the recording service client.
        self._recording_client = self._robot.ensure_client(
            GraphNavRecordingServiceClient.default_service_name)

        self._command_dictionary = {
            '1': self._get_localization_state,
            '2': self._set_initial_localization_fiducial,
            '3': self._set_initial_localization_waypoint,
            '4': self._list_graph_waypoint_and_edge_ids,
            '5': self._upload_graph_and_snapshots,
            '6': self._navigate_to,
            '7': self._navigate_route,
            '8': self._navigate_to_anchor,
            '9': self._clear_graph
        }

    def _stand_park(self, body_height):
        is_powered_on = self.check_is_powered_on()
        if is_powered_on:
            cmd = RobotCommandBuilder.synchro_stand_command(body_height=body_height)
            self._robot_command_client.robot_command(cmd)
            self._robot.logger.info("Robot standing tall.")

    def _power_on(self):
        # Now, we are ready to power on the robot. This call will block until the power
        # is on. Commands would fail if this did not happen. We can also check that the robot is
        # powered at any point.
        self._robot.logger.info("Powering on robot... This may take several seconds.")
        self._robot.power_on(timeout_sec=20)
        assert self._robot.is_powered_on(), "Robot power on failed."
        self._robot.logger.info("Robot powered on.")

    def _power_off(self):
        is_powered_on = self.check_is_powered_on()
        if is_powered_on:
            # Power the robot off. By specifying "cut_immediately=False", a safe power off command
            # is issued to the robot. This will attempt to sit the robot before powering off.
            self._robot.power_off(cut_immediately=False, timeout_sec=20)
            assert not self._robot.is_powered_on(), "Robot power off failed."
            self._robot.logger.info("Robot safely powered off.")

    def _stand_up(self):
        is_powered_on = self.check_is_powered_on()
        if is_powered_on:
            # Tell the robot to stand up. The command service is used to issue commands to a robot.
            # The set of valid commands for a robot depends on hardware configuration. See
            # SpotCommandHelper for more detailed examples on command building. The robot
            # command service requires timesync between the robot and the client.
            self._robot.logger.info("Commanding robot to stand...")
            blocking_stand(self._robot_command_client, timeout_sec=10)
            self._robot.logger.info("Robot standing.")
            return True

    def _sit_down(self):
        is_powered_on = self.check_is_powered_on()
        if is_powered_on:
            cmd = RobotCommandBuilder.synchro_sit_command()
            self._robot_command_client.robot_command(cmd)
            self._robot.logger.info("Robot sit down.")

    def _stand_higher(self, body_height):
        is_powered_on = self.check_is_powered_on()
        if is_powered_on:
            # Now tell the robot to stand taller, using the same approach of constructing
            # a command message with the RobotCommandBuilder and issuing it with
            # robot_command.
            cmd = RobotCommandBuilder.synchro_stand_command(body_height=body_height)
            self._robot_command_client.robot_command(cmd)
            self._robot.logger.info("Robot standing tall.")
            return True

    def _stand_lower(self, body_height):
        is_powered_on = self.check_is_powered_on()
        if is_powered_on:
            cmd = RobotCommandBuilder.synchro_stand_command(body_height=body_height)
            self._robot_command_client.robot_command(cmd)
            self._robot.logger.info("Robot standing lower.")
            return True

    def _stand_normal(self, body_height):
        is_powered_on = self.check_is_powered_on()
        if is_powered_on:
            cmd = RobotCommandBuilder.synchro_stand_command(body_height=body_height)
            self._robot_command_client.robot_command(cmd)
            self._robot.logger.info("Robot standing lower.")
            return True

    def _move_forward(self, velocity_speed, body_height):
        is_powered_on = self.check_is_powered_on()
        if is_powered_on:
            cmd = RobotCommandBuilder.synchro_velocity_command(v_x=velocity_speed, v_y=0.0, v_rot=0.0,
                                                               body_height=body_height)
            self._robot_command_client.robot_command(cmd, end_time_secs=time.time() + self._VELOCITY_CMD_DURATION)
            self._robot.logger.info("Robot move forward.")

    def _move_backward(self, velocity_speed, body_height):
        is_powered_on = self.check_is_powered_on()
        if is_powered_on:
            cmd = RobotCommandBuilder.synchro_velocity_command(v_x=-velocity_speed, v_y=0.0, v_rot=0.0,
                                                               body_height=body_height)
            self._robot_command_client.robot_command(cmd, end_time_secs=time.time() + self._VELOCITY_CMD_DURATION)
            self._robot.logger.info("Robot move backward.")

    def _strafe_left(self, body_height):
        is_powered_on = self.check_is_powered_on()
        if is_powered_on:
            cmd = RobotCommandBuilder.synchro_velocity_command(v_x=0.0, v_y=self._VELOCITY_BASE_SPEED, v_rot=0.0,
                                                               body_height=body_height)
            self._robot_command_client.robot_command(cmd, end_time_secs=time.time() + self._VELOCITY_CMD_DURATION)
            self._robot.logger.info("Robot move left.")

    def _strafe_right(self, body_height):
        is_powered_on = self.check_is_powered_on()
        if is_powered_on:
            cmd = RobotCommandBuilder.synchro_velocity_command(v_x=0.0, v_y=-self._VELOCITY_BASE_SPEED, v_rot=0.0,
                                                               body_height=body_height)
            self._robot_command_client.robot_command(cmd, end_time_secs=time.time() + self._VELOCITY_CMD_DURATION)
            self._robot.logger.info("Robot move right.")

    def _turn_left(self, body_height):
        is_powered_on = self.check_is_powered_on()
        if is_powered_on:
            cmd = RobotCommandBuilder.synchro_velocity_command(v_x=0.0, v_y=0.0, v_rot=self._VELOCITY_BASE_ANGULAR,
                                                               body_height=body_height)
            self._robot_command_client.robot_command(cmd, end_time_secs=time.time() + self._VELOCITY_CMD_DURATION)
            self._robot.logger.info("Robot turn left.")

    def _turn_right(self, body_height):
        is_powered_on = self.check_is_powered_on()
        if is_powered_on:
            cmd = RobotCommandBuilder.synchro_velocity_command(v_x=0.0, v_y=0.0, v_rot=-self._VELOCITY_BASE_ANGULAR,
                                                               body_height=body_height)
            self._robot_command_client.robot_command(cmd, end_time_secs=time.time() + self._VELOCITY_CMD_DURATION)
            self._robot.logger.info("Robot turn right.")

    def _get_localization_state(self, *args):
        """Get the current localization and state of the robot."""
        state = self._graph_nav_client.get_localization_state()
        print('Got localization: \n%s' % str(state.localization))
        odom_tform_body = get_odom_tform_body(state.robot_kinematics.transforms_snapshot)
        print('Got robot state in kinematic odometry frame: \n%s' % str(odom_tform_body))

    def _set_initial_localization_fiducial(self, *args):
        """Trigger localization when near a fiducial."""
        robot_state = self._robot_state_client.get_robot_state()
        current_odom_tform_body = get_odom_tform_body(
            robot_state.kinematic_state.transforms_snapshot).to_proto()
        # Create an empty instance for initial localization since we are asking it to localize
        # based on the nearest fiducial.
        localization = nav_pb2.Localization()
        self._graph_nav_client.set_localization(initial_guess_localization=localization,
                                                ko_tform_body=current_odom_tform_body)

    def _set_initial_localization_waypoint(self, ip):
        """Trigger localization to a waypoint."""
        # Take the first argument as the localization waypoint.
        if len(ip) < 1:
            # If no waypoint id is given as input, then return without initializing.
            print("No waypoint specified to initialize to.")
            return
        destination_waypoint = graph_nav_util.find_unique_waypoint_id(
            ip, self._current_graph, self._current_annotation_name_to_wp_id)
        if not destination_waypoint:
            # Failed to find the unique waypoint id.
            return

        robot_state = self._robot_state_client.get_robot_state()
        current_odom_tform_body = get_odom_tform_body(
            robot_state.kinematic_state.transforms_snapshot).to_proto()
        # Create an initial localization to the specified waypoint as the identity.
        localization = nav_pb2.Localization()
        localization.waypoint_id = destination_waypoint
        localization.waypoint_tform_body.rotation.w = 1.0
        self._graph_nav_client.set_localization(
            initial_guess_localization=localization,
            # It's hard to get the pose perfect, search +/-20 deg and +/-20cm (0.2m).
            max_distance=0.2,
            max_yaw=20.0 * math.pi / 180.0,
            fiducial_init=graph_nav_pb2.SetLocalizationRequest.FIDUCIAL_INIT_NO_FIDUCIAL,
            ko_tform_body=current_odom_tform_body)

    def should_we_start_recording(self):
        # Before starting to record, check the state of the GraphNav system.
        graph = self._graph_nav_client.download_graph()
        if graph is not None:
            # Check that the graph has waypoints. If it does, then we need to be localized to the graph
            # before starting to record
            if len(graph.waypoints) > 0:
                localization_state = self._graph_nav_client.get_localization_state()
                if not localization_state.localization.waypoint_id:
                    # Not localized to anything in the map. The best option is to clear the graph or
                    # attempt to localize to the current map.
                    # Returning false since the GraphNav system is not in the state it should be to
                    # begin recording.
                    return False
        # If there is no graph or there exists a graph that we are localized to, then it is fine to
        # start recording, so we return True.
        return True

    def _start_recording(self, *args):
        """Start recording a map."""
        should_start_recording = self.should_we_start_recording()
        if not should_start_recording:
            print("The system is not in the proper state to start recording.", \
                   "Try using the graph_nav_command_line to either clear the map or", \
                   "attempt to localize to the map.")
            return
        try:
            status = self._recording_client.start_recording()
            print("Successfully started recording a map.")
        except Exception as err:
            print("Start recording failed: "+str(err))

    def _stop_recording(self, *args):
        """Stop or pause recording a map."""
        try:
            status = self._recording_client.stop_recording()
            print("Successfully stopped recording a map.")
        except Exception as err:
            print("Stop recording failed: " + str(err))

    def _create_default_waypoint(self, *args):
        """Create a default waypoint at the robot's current location."""
        resp = self._recording_client.create_waypoint(waypoint_name="default")
        if resp.status == recording_pb2.CreateWaypointResponse.STATUS_OK:
            print("Successfully created a waypoint.")
        else:
            print("Could not create a waypoint.")

    def _list_graph_waypoint_and_edge_ids(self, *args):
        """List the waypoint ids and edge ids of the graph currently on the robot."""

        # Download current graph
        graph = self._graph_nav_client.download_graph()
        if graph is None:
            print("Empty graph.")
            return
        self._current_graph = graph

        localization_id = self._graph_nav_client.get_localization_state().localization.waypoint_id

        # Update and print waypoints and edges
        self._current_annotation_name_to_wp_id, self._current_edges = graph_nav_util.update_waypoints_and_edges(
            graph, localization_id)
        return self._current_annotation_name_to_wp_id['default']

    def _upload_graph_and_snapshots(self, *args):
        """Upload the graph and snapshots to the robot."""
        print("Loading the graph from disk into local storage...")
        with open(self._upload_filepath + "/graph", "rb") as graph_file:
            # Load the graph from disk.
            data = graph_file.read()
            self._current_graph = map_pb2.Graph()
            self._current_graph.ParseFromString(data)
            print("Loaded graph has {} waypoints and {} edges".format(
                len(self._current_graph.waypoints), len(self._current_graph.edges)))
        for waypoint in self._current_graph.waypoints:
            # Load the waypoint snapshots from disk.
            with open(self._upload_filepath + "/waypoint_snapshots/{}".format(waypoint.snapshot_id),
                      "rb") as snapshot_file:
                waypoint_snapshot = map_pb2.WaypointSnapshot()
                waypoint_snapshot.ParseFromString(snapshot_file.read())
                self._current_waypoint_snapshots[waypoint_snapshot.id] = waypoint_snapshot
        for edge in self._current_graph.edges:
            if len(edge.snapshot_id) == 0:
                continue
            # Load the edge snapshots from disk.
            with open(self._upload_filepath + "/edge_snapshots/{}".format(edge.snapshot_id),
                      "rb") as snapshot_file:
                edge_snapshot = map_pb2.EdgeSnapshot()
                edge_snapshot.ParseFromString(snapshot_file.read())
                self._current_edge_snapshots[edge_snapshot.id] = edge_snapshot
        # Upload the graph to the robot.
        print("Uploading the graph and snapshots to the robot...")
        true_if_empty = not len(self._current_graph.anchoring.anchors)
        response = self._graph_nav_client.upload_graph(lease=self._lease.lease_proto,
                                                       graph=self._current_graph,
                                                       generate_new_anchoring=true_if_empty)
        # Upload the snapshots to the robot.
        for snapshot_id in response.unknown_waypoint_snapshot_ids:
            waypoint_snapshot = self._current_waypoint_snapshots[snapshot_id]
            self._graph_nav_client.upload_waypoint_snapshot(waypoint_snapshot)
            print("Uploaded {}".format(waypoint_snapshot.id))
        for snapshot_id in response.unknown_edge_snapshot_ids:
            edge_snapshot = self._current_edge_snapshots[snapshot_id]
            self._graph_nav_client.upload_edge_snapshot(edge_snapshot)
            print("Uploaded {}".format(edge_snapshot.id))

        # The upload is complete! Check that the robot is localized to the graph,
        # and it if is not, prompt the user to localize the robot before attempting
        # any navigation commands.
        localization_state = self._graph_nav_client.get_localization_state()
        if not localization_state.localization.waypoint_id:
            # The robot is not localized to the newly uploaded graph.
            print("\n")
            print("Upload complete! The robot is currently not localized to the map; please localize", \
                   "the robot using commands (2) or (3) before attempting a navigation command.")

    def _navigate_to_anchor(self, *args):
        """Navigate to a pose in seed frame, using anchors."""
        # The following options are accepted for arguments: [x, y], [x, y, yaw], [x, y, z, yaw],
        # [x, y, z, qw, qx, qy, qz].
        # When a value for z is not specified, we use the current z height.
        # When only yaw is specified, the quaternion is constructed from the yaw.
        # When yaw is not specified, an identity quaternion is used.

        if len(args) < 1 or len(args[0]) not in [2, 3, 4, 7]:
            print("Invalid arguments supplied.")
            return

        seed_T_goal = SE3Pose(float(args[0][0]), float(args[0][1]), 0.0, Quat())

        if len(args[0]) in [4, 7]:
            seed_T_goal.z = float(args[0][2])
        else:
            localization_state = self._graph_nav_client.get_localization_state()
            if not localization_state.localization.waypoint_id:
                print("Robot not localized")
                return
            seed_T_goal.z = localization_state.localization.seed_tform_body.position.z

        if len(args[0]) == 3:
            seed_T_goal.rot = Quat.from_yaw(float(args[0][2]))
        elif len(args[0]) == 4:
            seed_T_goal.rot = Quat.from_yaw(float(args[0][3]))
        elif len(args[0]) == 7:
            seed_T_goal.rot = Quat(w=float(args[0][3]), x=float(args[0][4]), y=float(args[0][5]),
                                   z=float(args[0][6]))

        self._lease = self._lease_wallet.get_lease()
        if not self.toggle_power(should_power_on=True):
            print("Failed to power on the robot, and cannot complete navigate to request.")
            return

        # Stop the lease keepalive and create a new sublease for graph nav.
        self._lease = self._lease_wallet.advance()
        sublease = self._lease.create_sublease()
        self._lease_keepalive.shutdown()
        nav_to_cmd_id = None
        # Navigate to the destination.
        is_finished = False
        while not is_finished:
            # Issue the navigation command about twice a second such that it is easy to terminate the
            # navigation command (with estop or killing the program).
            try:
                nav_to_cmd_id = self._graph_nav_client.navigate_to_anchor(
                    seed_T_goal.to_proto(), 1.0, leases=[sublease.lease_proto],
                    command_id=nav_to_cmd_id)
            except ResponseError as e:
                print("Error while navigating {}".format(e))
                break
            time.sleep(.5)  # Sleep for half a second to allow for command execution.
            # Poll the robot for feedback to determine if the navigation command is complete. Then sit
            # the robot down once it is finished.
            is_finished = self._check_success(nav_to_cmd_id)

        self._lease = self._lease_wallet.advance()
        self._lease_keepalive = LeaseKeepAlive(self._lease_client)

        # Update the lease and power off the robot if appropriate.
        if self._powered_on and not self._started_powered_on:
            # Sit the robot down + power off after the navigation command is complete.
            self.toggle_power(should_power_on=False)

    def _navigate_to(self, id):
        """Navigate to a specific waypoint."""
        # Take the first argument as the destination waypoint.
        if len(id) < 1:
            # If no waypoint id is given as input, then return without requesting navigation.
            print("No waypoint provided as a destination for navigate to.")
            return

        self._lease = self._lease_wallet.get_lease()
        destination_waypoint = graph_nav_util.find_unique_waypoint_id(
            id, self._current_graph, self._current_annotation_name_to_wp_id)
        if not destination_waypoint:
            # Failed to find the appropriate unique waypoint id for the navigation command.
            return
        if not self.toggle_power(should_power_on=True):
            print("Failed to power on the robot, and cannot complete navigate to request.")
            return

        # Stop the lease keep-alive and create a new sublease for graph nav.
        self._lease = self._lease_wallet.advance()
        sublease = self._lease.create_sublease()
        self._lease_keepalive.shutdown()
        nav_to_cmd_id = None
        # Navigate to the destination waypoint.
        is_finished = False
        while not is_finished:
            # Issue the navigation command about twice a second such that it is easy to terminate the
            # navigation command (with estop or killing the program).
            try:
                nav_to_cmd_id = self._graph_nav_client.navigate_to(destination_waypoint, 1.0,
                                                                   leases=[sublease.lease_proto],
                                                                   command_id=nav_to_cmd_id)
            except ResponseError as e:
                print("Error while navigating {}".format(e))
                break
            time.sleep(.5)  # Sleep for half a second to allow for command execution.
            # Poll the robot for feedback to determine if the navigation command is complete. Then sit
            # the robot down once it is finished.
            is_finished = self._check_success(nav_to_cmd_id)

        self._lease = self._lease_wallet.advance()
        self._lease_keepalive = LeaseKeepAlive(self._lease_client)

        #Update the lease and power off the robot if appropriate.
        # if self._powered_on and not self._started_powered_on:
        #     # Sit the robot down + power off after the navigation command is complete.
        #     self.toggle_power(should_power_on=False)

    def _navigate_route(self, *args):
        """Navigate through a specific route of waypoints."""
        if len(args) < 1 or len(args[0]) < 1:
            # If no waypoint ids are given as input, then return without requesting navigation.
            print("No waypoints provided for navigate route.")
            return
        waypoint_ids = args[0]
        for i in range(len(waypoint_ids)):
            waypoint_ids[i] = graph_nav_util.find_unique_waypoint_id(
                waypoint_ids[i], self._current_graph, self._current_annotation_name_to_wp_id)
            if not waypoint_ids[i]:
                # Failed to find the unique waypoint id.
                return

        edge_ids_list = []
        all_edges_found = True
        # Attempt to find edges in the current graph that match the ordered waypoint pairs.
        # These are necessary to create a valid route.
        for i in range(len(waypoint_ids) - 1):
            start_wp = waypoint_ids[i]
            end_wp = waypoint_ids[i + 1]
            edge_id = self._match_edge(self._current_edges, start_wp, end_wp)
            if edge_id is not None:
                edge_ids_list.append(edge_id)
            else:
                all_edges_found = False
                print("Failed to find an edge between waypoints: ", start_wp, " and ", end_wp)
                print(
                    "List the graph's waypoints and edges to ensure pairs of waypoints has an edge."
                )
                break

        self._lease = self._lease_wallet.get_lease()
        if all_edges_found:
            if not self.toggle_power(should_power_on=True):
                print("Failed to power on the robot, and cannot complete navigate route request.")
                return

            # Stop the lease keep-alive and create a new sublease for graph nav.
            self._lease = self._lease_wallet.advance()
            sublease = self._lease.create_sublease()
            self._lease_keepalive.shutdown()

            # Navigate a specific route.
            route = self._graph_nav_client.build_route(waypoint_ids, edge_ids_list)
            is_finished = False
            while not is_finished:
                # Issue the route command about twice a second such that it is easy to terminate the
                # navigation command (with estop or killing the program).
                nav_route_command_id = self._graph_nav_client.navigate_route(
                    route, cmd_duration=1.0, leases=[sublease.lease_proto])
                time.sleep(.5)  # Sleep for half a second to allow for command execution.
                # Poll the robot for feedback to determine if the route is complete. Then sit
                # the robot down once it is finished.
                is_finished = self._check_success(nav_route_command_id)

            self._lease = self._lease_wallet.advance()
            self._lease_keepalive = LeaseKeepAlive(self._lease_client)

            # Update the lease and power off the robot if appropriate.
            if self._powered_on and not self._started_powered_on:
                # Sit the robot down + power off after the navigation command is complete.
                self.toggle_power(should_power_on=False)

    def _clear_graph(self, *args):
        """Clear the state of the map on the robot, removing all waypoints and edges."""
        return self._graph_nav_client.clear_graph(lease=self._lease.lease_proto)

    def toggle_power(self, should_power_on):
        """Power the robot on/off dependent on the current power state."""
        is_powered_on = self.check_is_powered_on()
        if not is_powered_on and should_power_on:
            # Power on the robot up before navigating when it is in a powered-off state.
            power_on(self._power_client)
            motors_on = False
            while not motors_on:
                future = self._robot_state_client.get_robot_state_async()
                state_response = future.result(
                    timeout=10)  # 10 second timeout for waiting for the state response.
                if state_response.power_state.motor_power_state == robot_state_pb2.PowerState.STATE_ON:
                    motors_on = True
                else:
                    # Motors are not yet fully powered on.
                    time.sleep(.25)
        elif is_powered_on and not should_power_on:
            # Safe power off (robot will sit then power down) when it is in a
            # powered-on state.
            safe_power_off(self._robot_command_client, self._robot_state_client)
        else:
            # Return the current power state without change.
            return is_powered_on
        # Update the locally stored power state.
        self.check_is_powered_on()
        return self._powered_on

    def check_is_powered_on(self):
        """Determine if the robot is powered on or off."""
        power_state = self._robot_state_client.get_robot_state().power_state
        self._powered_on = (power_state.motor_power_state == power_state.STATE_ON)
        return self._powered_on

    def _check_success(self, command_id=-1):
        """Use a navigation command id to get feedback from the robot and sit when command succeeds."""
        if command_id == -1:
            # No command, so we have not status to check.
            return False
        status = self._graph_nav_client.navigation_feedback(command_id)
        if status.status == graph_nav_pb2.NavigationFeedbackResponse.STATUS_REACHED_GOAL:
            # Successfully completed the navigation commands!
            return True
        elif status.status == graph_nav_pb2.NavigationFeedbackResponse.STATUS_LOST:
            print("Robot got lost when navigating the route, the robot will now sit down.")
            return True
        elif status.status == graph_nav_pb2.NavigationFeedbackResponse.STATUS_STUCK:
            print("Robot got stuck when navigating the route, the robot will now sit down.")
            return True
        elif status.status == graph_nav_pb2.NavigationFeedbackResponse.STATUS_ROBOT_IMPAIRED:
            print("Robot is impaired.")
            return True
        else:
            # Navigation command is not complete yet.
            return False

    def _match_edge(self, current_edges, waypoint1, waypoint2):
        """Find an edge in the graph that is between two waypoint ids."""
        # Return the correct edge id as soon as it's found.
        for edge_to_id in current_edges:
            for edge_from_id in current_edges[edge_to_id]:
                if (waypoint1 == edge_to_id) and (waypoint2 == edge_from_id):
                    # This edge matches the pair of waypoints! Add it the edge list and continue.
                    return map_pb2.Edge.Id(from_waypoint=waypoint2, to_waypoint=waypoint1)
                elif (waypoint2 == edge_to_id) and (waypoint1 == edge_from_id):
                    # This edge matches the pair of waypoints! Add it the edge list and continue.
                    return map_pb2.Edge.Id(from_waypoint=waypoint1, to_waypoint=waypoint2)
        return None

    def return_lease(self):
        """Shutdown lease keep-alive and return lease."""
        self._lease_keepalive.shutdown()
        self._lease_client.return_lease(self._lease)

    def _on_quit(self):
        """Cleanup on quit from the command line interface."""
        # Sit the robot down + power off after the navigation command is complete.
        if self._powered_on and not self._started_powered_on:
            self._robot_command_client.robot_command(RobotCommandBuilder.safe_power_off_command(),
                                                     end_time_secs=time.time())
        self.return_lease()

    def run(self):
        """Main loop for the command line interface."""
        while True:
            print("""
            Options:
            (1) Get localization state.
            (2) Initialize localization to the nearest fiducial (must be in sight of a fiducial).
            (3) Initialize localization to a specific waypoint (must be exactly at the waypoint).
            (4) List the waypoint ids and edge ids of the map on the robot.
            (5) Upload the graph and its snapshots.
            (6) Navigate to. The destination waypoint id is the second argument.
            (7) Navigate route. The (in-order) waypoint ids of the route are the arguments.
            (8) Navigate to in seed frame. The following options are accepted for arguments: [x, y],
                [x, y, yaw], [x, y, z, yaw], [x, y, z, qw, qx, qy, qz]. (Don't type the braces).
                When a value for z is not specified, we use the current z height.
                When only yaw is specified, the quaternion is constructed from the yaw.
                When yaw is not specified, an identity quaternion is used.
            (9) Clear the current graph.
            (q) Exit.
            """)
            try:
                inputs = input('>')
            except NameError:
                pass
            req_type = str.split(inputs)[0]

            if req_type == 'q':
                self._on_quit()
                break

            if req_type not in self._command_dictionary:
                print("Request not in the known command dictionary.")
                continue
            try:
                cmd_func = self._command_dictionary[req_type]
                cmd_func(str.split(inputs)[1:])
            except Exception as e:
                print(e)


def main(argv):
    """Run the command-line interface."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('-u', '--upload-filepath',
                        help='Full filepath to graph and snapshots to be uploaded.', required=True)
    bosdyn.client.util.add_common_arguments(parser)
    options = parser.parse_args(argv)

    # Setup and authenticate the robot.
    sdk = bosdyn.client.create_standard_sdk('GraphNavClient')
    robot = sdk.create_robot(options.hostname)
    robot.authenticate(options.username, options.password)

    estop_client = robot.ensure_client(EstopClient.default_service_name)
    estop_endpoint = EstopEndpoint(estop_client, 'GNClient', 9.0)
    estop_keepalive = None
    if estop_endpoint is not None:
        estop_endpoint.force_simple_setup(
        )
    estop_keepalive = EstopKeepAlive(estop_endpoint)
    assert not robot.is_estopped(), "Robot is estopped. Please use an external E-Stop client, " \
                                    "such as the estop SDK example, to configure E-Stop."

    # generate socket
    tcpClientSocket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    print('socket---%s' % tcpClientSocket)
    # connect server
    # serverAddr = ('192.168.1.84', 9003)
    serverAddr = ('192.168.10.129', 9003)
    tcpClientSocket.connect(serverAddr)
    print('connect success!')
    # id for spot robot
    sendData = 'Spot1'
    # transfer to binary data
    sendData = sendData.encode('ascii')
    # send the id to tcp server
    tcpClientSocket.send(sendData)

    graph_nav_command_line = GraphNavInterface(robot, options.upload_filepath)


    velocitySpeed = 0.5
    # set the initial body height for robot
    bodyHeight = 0.0
    # set the navigation status
    navigationStatus = ''
    # set the reset model
    reset = False
    # set check status
    check_status = False

    orginId = 'eb'
    reactorId = 'bp'
    pumpId = 'gm'
    # set the position of robot
    positionId = 'ce'
    while True:
        # receive data
        recvData = tcpClientSocket.recv(1024)
        # transfer to string
        recvData = recvData.decode('ascii')
        if "}{" in recvData:
            recvData = recvData[recvData.rfind('{'):recvData.rfind('}') + 1]
        # transfer to json object
        recvData = json.loads(recvData)
        # print the received data
        print('the receive message is:%s' % recvData['label'])
        sendData = navigationStatus
        # transfer to binary data
        sendData = sendData.encode('ascii')
        # send the id to tcp server
        tcpClientSocket.send(sendData)
        try:
            if recvData['label'] == 'Monitor':
                reset = False
                check_status = True
                if navigationStatus == 'Autonomous':
                    navigationStatus = 'Monitor'
                    sendData = 'Monitor'
                    # transfer to binary data
                    sendData = sendData.encode('ascii')
                    # send the id to tcp server
                    tcpClientSocket.send(sendData)
                if navigationStatus == '':
                    graph_nav_command_line._clear_graph()
                    graph_nav_command_line._upload_graph_and_snapshots()
                    graph_nav_command_line._set_initial_localization_waypoint(positionId)
                    navigationStatus = 'Monitor'
                    sendData = 'Monitor'
                    # transfer to binary data
                    sendData = sendData.encode('ascii')
                    # send the id to tcp server
                    tcpClientSocket.send(sendData)
                if navigationStatus == 'Manually':
                    graph_nav_command_line._stop_recording()
                    originPoint = graph_nav_command_line._list_graph_waypoint_and_edge_ids()
                    print(originPoint)
                    graph_nav_command_line._navigate_to(originPoint)
                    graph_nav_command_line._clear_graph()
                    graph_nav_command_line._upload_graph_and_snapshots()
                    graph_nav_command_line._set_initial_localization_waypoint(positionId)
                    navigationStatus = 'Monitor'
                    sendData = 'Monitor'
                    # transfer to binary data
                    sendData = sendData.encode('ascii')
                    # send the id to tcp server
                    tcpClientSocket.send(sendData)
            if recvData['label'] == 'Autonomous':
                reset = False
                if navigationStatus == 'Monitor':
                    navigationStatus = 'Autonomous'
                    sendData = 'Autonomous'
                    # transfer to binary data
                    sendData = sendData.encode('ascii')
                    # send the id to tcp server
                    tcpClientSocket.send(sendData)
                if navigationStatus == '':
                    graph_nav_command_line._clear_graph()
                    graph_nav_command_line._upload_graph_and_snapshots()
                    graph_nav_command_line._set_initial_localization_waypoint(positionId)
                    navigationStatus = 'Autonomous'
                    sendData = 'Autonomous'
                    # transfer to binary data
                    sendData = sendData.encode('ascii')
                    # send the id to tcp server
                    tcpClientSocket.send(sendData)
                if navigationStatus == 'Manually':
                    graph_nav_command_line._stop_recording()
                    originPoint = graph_nav_command_line._list_graph_waypoint_and_edge_ids()
                    print(originPoint)
                    graph_nav_command_line._navigate_to(originPoint)
                    graph_nav_command_line._clear_graph()
                    graph_nav_command_line._upload_graph_and_snapshots()
                    graph_nav_command_line._set_initial_localization_waypoint(positionId)
                    navigationStatus = 'Autonomous'
                    sendData = 'Autonomous'
                    # transfer to binary data
                    sendData = sendData.encode('ascii')
                    # send the id to tcp server
                    tcpClientSocket.send(sendData)
            if recvData['label'] == 'Manually':
                graph_nav_command_line._clear_graph()
                graph_nav_command_line._start_recording()
                graph_nav_command_line._create_default_waypoint()
                if navigationStatus == 'Autonomous' or navigationStatus == 'Monitor':
                    sendData = 'autonomous_state'
                    # transfer to binary data
                    sendData = sendData.encode('ascii')
                    # send the id to tcp server
                    tcpClientSocket.send(sendData)
                else:
                    sendData = 'Manually'
                    # transfer to binary data
                    sendData = sendData.encode('ascii')
                    # send the id to tcp server
                    tcpClientSocket.send(sendData)
                navigationStatus = 'Manually'
                reset = False
            if recvData['label'] == 'Reset':
                if navigationStatus == '':
                    graph_nav_command_line._stop_recording()
                    graph_nav_command_line._clear_graph()
                    reset = True
                    graph_nav_command_line._power_off()
                    sendData = 'Reset'
                    # transfer to binary data
                    sendData = sendData.encode('ascii')
                    # send the id to tcp server
                    tcpClientSocket.send(sendData)
                if navigationStatus == 'Manually':
                    graph_nav_command_line._stop_recording()
                    graph_nav_command_line._clear_graph()
                    navigationStatus = ''
                    reset = True
                    graph_nav_command_line._power_off()
                    sendData = 'Reset'
                    # transfer to binary data
                    sendData = sendData.encode('ascii')
                    # send the id to tcp server
                    tcpClientSocket.send(sendData)
                if navigationStatus == 'Autonomous' or navigationStatus == 'Monitor':
                    graph_nav_command_line._clear_graph()
                    navigationStatus = ''
                    reset = True
                    graph_nav_command_line._power_off()
                    sendData = 'Reset'
                    # transfer to binary data
                    sendData = sendData.encode('ascii')
                    # send the id to tcp server
                    tcpClientSocket.send(sendData)

            if (recvData['label'] == 'Reactor' and navigationStatus == 'Autonomous') or \
                    (recvData['label'] == 'Reactor' and navigationStatus == 'Monitor' and positionId != reactorId and check_status == False):
                check_status = True
                graph_nav_command_line._navigate_to(reactorId)
                positionId = reactorId
                sendData = 'ReactorArrive'
                # transfer to binary data
                sendData = sendData.encode('ascii')
                # send the id to tcp server
                tcpClientSocket.send(sendData)
            if (recvData['label'] == 'Pump' and navigationStatus == 'Autonomous') or \
                    (recvData['label'] == 'Pump' and navigationStatus == 'Monitor' and positionId != pumpId and check_status == False):
                check_status = True
                graph_nav_command_line._navigate_to(pumpId)
                positionId = pumpId
                sendData = 'PumpArrive'
                # transfer to binary data
                sendData = sendData.encode('ascii')
                # send the id to tcp server
                tcpClientSocket.send(sendData)
            if recvData['label'] == 'Origin' and navigationStatus == 'Autonomous':
                graph_nav_command_line._navigate_to(orginId)
                positionId = orginId
                sendData = 'OriginArrive'
                # transfer to binary data
                sendData = sendData.encode('ascii')
                # send the id to tcp server
                tcpClientSocket.send(sendData)

            if recvData['label'] == 'Acknowledge' and navigationStatus == 'Monitor':
                check_status = False
            if recvData['label'] == 'P' and (navigationStatus == 'Manually' or reset is True):
                graph_nav_command_line._stand_park(bodyHeight)
            if recvData['label'] == '+' and (navigationStatus == 'Manually' or reset is True):
                graph_nav_command_line._move_forward(velocitySpeed, bodyHeight)
            if recvData['label'] == 'H' and (navigationStatus == 'Manually' or reset is True):
                bodyHeight = 0.1
                stand_state = graph_nav_command_line._stand_higher(bodyHeight)
                if stand_state==True:
                    sendData = 'StandHigher'
                    # transfer to binary data
                    sendData = sendData.encode('ascii')
                    # send the id to tcp server
                    tcpClientSocket.send(sendData)
            if recvData['label'] == '-' and (navigationStatus == 'Manually' or reset is True):
                graph_nav_command_line._move_backward(velocitySpeed, bodyHeight)
            if recvData['label'] == 'L' and (navigationStatus == 'Manually' or reset is True):
                bodyHeight = -0.1
                stand_state = graph_nav_command_line._stand_lower(bodyHeight)
                if stand_state==True:
                    sendData = 'StandLower'
                    # transfer to binary data
                    sendData = sendData.encode('ascii')
                    # send the id to tcp server
                    tcpClientSocket.send(sendData)
            if recvData['label'] == '>' and (navigationStatus == 'Manually' or reset is True):
                graph_nav_command_line._strafe_right(bodyHeight)
            if recvData['label'] == '>>' and (navigationStatus == 'Manually' or reset is True):
                graph_nav_command_line._turn_right(bodyHeight)
            if recvData['label'] == '<' and (navigationStatus == 'Manually' or reset is True):
                graph_nav_command_line._strafe_left(bodyHeight)
            if recvData['label'] == '<<' and (navigationStatus == 'Manually' or reset is True):
                graph_nav_command_line._turn_left(bodyHeight)
            if recvData['label'] == '++' and (navigationStatus == 'Manually' or reset is True):
                velocitySpeed = velocitySpeed + 0.1
                if velocitySpeed >= 1.0:
                    velocitySpeed = 1.0
            if recvData['label'] == '--' and (navigationStatus == 'Manually' or reset is True):
                velocitySpeed = velocitySpeed - 0.1
                if velocitySpeed <= 0.2:
                    velocitySpeed = 0.3
            if recvData['label'] == 'StandNormal' and (navigationStatus == 'Manually' or reset is True):
                bodyHeight = 0.0
                stand_state=graph_nav_command_line._stand_normal(bodyHeight)
                if stand_state==True:
                    sendData = 'StandNormal'
                    # transfer to binary data
                    sendData = sendData.encode('ascii')
                    # send the id to tcp server
                    tcpClientSocket.send(sendData)
            if recvData['label'] == 'PowerOn' and (navigationStatus == 'Manually' or reset is True):
                graph_nav_command_line._power_on()
                sendData = 'PowerOn'
                # transfer to binary data
                sendData = sendData.encode('ascii')
                # send the id to tcp server
                tcpClientSocket.send(sendData)
            if recvData['label'] == 'PowerOff' and (navigationStatus == 'Manually' or reset is True):
                graph_nav_command_line._power_off()
                sendData = 'PowerOff'
                # transfer to binary data
                sendData = sendData.encode('ascii')
                # send the id to tcp server
                tcpClientSocket.send(sendData)
            if recvData['label'] == 'Stand' and (navigationStatus == 'Manually' or reset is True):
                stand_state = graph_nav_command_line._stand_up()
                if stand_state == True:
                    sendData = 'Standing'
                    # transfer to binary data
                    sendData = sendData.encode('ascii')
                    # send the id to tcp server
                    tcpClientSocket.send(sendData)
            if recvData['label'] == 'Sit' and (navigationStatus == 'Manually' or reset is True):
                graph_nav_command_line._sit_down()
                sendData = 'Sitting'
                # transfer to binary data
                sendData = sendData.encode('ascii')
                # send the id to tcp server
                tcpClientSocket.send(sendData)
        except Exception as exc:  # pylint: disable=broad-except
            print(exc)
            print("Graph nav command line client threw an error.")
            graph_nav_command_line.return_lease()
            return False


if __name__ == '__main__':
    exit_code = 0
    if not main(sys.argv[1:]):
        exit_code = 1
    os._exit(exit_code)  # Exit hard, no cleanup that could block.