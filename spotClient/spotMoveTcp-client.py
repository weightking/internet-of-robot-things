from __future__ import print_function
import socket
import json
import sys
import time
import os
import bosdyn.client
import bosdyn.client.lease
import bosdyn.client.util
import bosdyn.geometry
from bosdyn.client.image import ImageClient, build_image_request
from bosdyn.client.robot_command import RobotCommandBuilder, RobotCommandClient, blocking_stand
from bosdyn.client.estop import EstopClient, EstopEndpoint, EstopKeepAlive
import numpy as np
import cv2
import graph_nav_util
from bosdyn.client.frame_helpers import get_odom_tform_body
from bosdyn.api.graph_nav import nav_pb2
from bosdyn.api.graph_nav import map_pb2

VELOCITY_BASE_SPEED = 0.5  # m/s
VELOCITY_BASE_ANGULAR = 0.8  # rad/sec
VELOCITY_CMD_DURATION = 0.6  # seconds
BODY_HEIGHT = 0.0  # m


def stand_park(body_height):
    cmd = RobotCommandBuilder.synchro_stand_command(body_height=body_height)
    command_client.robot_command(cmd)
    robot.logger.info("Robot standing tall.")


def power_on():
    # Now, we are ready to power on the robot. This call will block until the power
    # is on. Commands would fail if this did not happen. We can also check that the robot is
    # powered at any point.
    robot.logger.info("Powering on robot... This may take several seconds.")
    robot.power_on(timeout_sec=20)
    assert robot.is_powered_on(), "Robot power on failed."
    robot.logger.info("Robot powered on.")


def power_off():
    # Power the robot off. By specifying "cut_immediately=False", a safe power off command
    # is issued to the robot. This will attempt to sit the robot before powering off.
    robot.power_off(cut_immediately=False, timeout_sec=20)
    assert not robot.is_powered_on(), "Robot power off failed."
    robot.logger.info("Robot safely powered off.")


def stand_up():
    # Tell the robot to stand up. The command service is used to issue commands to a robot.
    # The set of valid commands for a robot depends on hardware configuration. See
    # SpotCommandHelper for more detailed examples on command building. The robot
    # command service requires timesync between the robot and the client.
    robot.logger.info("Commanding robot to stand...")
    blocking_stand(command_client, timeout_sec=10)
    robot.logger.info("Robot standing.")


def sit_down():
    cmd = RobotCommandBuilder.synchro_sit_command()
    command_client.robot_command(cmd)
    robot.logger.info("Robot sit down.")


def stand_higher(body_height):
    # Now tell the robot to stand taller, using the same approach of constructing
    # a command message with the RobotCommandBuilder and issuing it with
    # robot_command.
    cmd = RobotCommandBuilder.synchro_stand_command(body_height=body_height)
    command_client.robot_command(cmd)
    robot.logger.info("Robot standing tall.")


def stand_lower(body_height):
    cmd = RobotCommandBuilder.synchro_stand_command(body_height=body_height)
    command_client.robot_command(cmd)
    robot.logger.info("Robot standing lower.")


def stand_normal(body_height):
    cmd = RobotCommandBuilder.synchro_stand_command(body_height=body_height)
    command_client.robot_command(cmd)
    robot.logger.info("Robot standing lower.")


def move_forward(velocity_speed, body_height):
    cmd = RobotCommandBuilder.synchro_velocity_command(v_x=velocity_speed, v_y=0.0, v_rot=0.0, body_height=body_height)
    command_client.robot_command(cmd, end_time_secs=time.time() + VELOCITY_CMD_DURATION)
    robot.logger.info("Robot move forward.")


def move_backward(velocity_speed, body_height):
    cmd = RobotCommandBuilder.synchro_velocity_command(v_x=-velocity_speed, v_y=0.0, v_rot=0.0, body_height=body_height)
    command_client.robot_command(cmd, end_time_secs=time.time() + VELOCITY_CMD_DURATION)
    robot.logger.info("Robot move backward.")


def strafe_left(body_height):
    cmd = RobotCommandBuilder.synchro_velocity_command(v_x=0.0, v_y=VELOCITY_BASE_SPEED, v_rot=0.0,
                                                       body_height=body_height)
    command_client.robot_command(cmd, end_time_secs=time.time() + VELOCITY_CMD_DURATION)
    robot.logger.info("Robot move left.")


def strafe_right(body_height):
    cmd = RobotCommandBuilder.synchro_velocity_command(v_x=0.0, v_y=-VELOCITY_BASE_SPEED, v_rot=0.0,
                                                       body_height=body_height)
    command_client.robot_command(cmd, end_time_secs=time.time() + VELOCITY_CMD_DURATION)
    robot.logger.info("Robot move right.")


def turn_left(body_height):
    cmd = RobotCommandBuilder.synchro_velocity_command(v_x=0.0, v_y=0.0, v_rot=VELOCITY_BASE_ANGULAR,
                                                       body_height=body_height)
    command_client.robot_command(cmd, end_time_secs=time.time() + VELOCITY_CMD_DURATION)
    robot.logger.info("Robot turn left.")


def turn_right(body_height):
    cmd = RobotCommandBuilder.synchro_velocity_command(v_x=0.0, v_y=0.0, v_rot=-VELOCITY_BASE_ANGULAR,
                                                       body_height=body_height)
    command_client.robot_command(cmd, end_time_secs=time.time() + VELOCITY_CMD_DURATION)
    robot.logger.info("Robot turn right.")


def velocity_decrease(velocity_speed):
    velocity_speed = velocity_speed - 0.1
    if velocity_speed <= 1.0:
        velocity_speed = 0.2


if __name__ == '__main__':
    # The Boston Dynamics Python library uses Python's logging module to
    # generate output. Applications using the library can specify how
    # the logging information should be output.
    bosdyn.client.util.setup_logging()
    # The SDK object is the primary entry point to the Boston Dynamics API.
    # create_standard_sdk will initialize an SDK object with typical default
    # parameters. The argument passed in is a string identifying the client.
    sdk = bosdyn.client.create_standard_sdk('spotTcpClient1')
    # A Robot object represents a single robot. Clients using the Boston
    # Dynamics API can manage multiple robots, but this tutorial limits
    # access to just one. The network address of the robot needs to be
    # specified to reach it. This can be done with a DNS name
    # (e.g. spot.intranet.example.com) or an IP literal (e.g. 10.0.63.1)
    robot = sdk.create_robot('192.168.1.10')
    # Clients need to authenticate to a robot before being able to use it.
    robot.authenticate('duo', 'MISSyou1230jin')
    robot.sync_with_directory()
    # Establish time sync with the robot. This kicks off a background thread to establish time sync.
    # Time sync is required to issue commands to the robot. After starting time sync thread, block
    # until sync is established.
    robot.time_sync.wait_for_sync()
    # Verify the robot is not estopped and that an external application has registered and holds
    # an estop endpoint.

    estop_client = robot.ensure_client(EstopClient.default_service_name)
    estop_endpoint = EstopEndpoint(estop_client, 'GNClient', 9.0)
    estop_keepalive = None
    if estop_endpoint is not None:
        estop_endpoint.force_simple_setup(
        )
    estop_keepalive = EstopKeepAlive(estop_endpoint)
    assert not robot.is_estopped(), "Robot is estopped. Please use an external E-Stop client, " \
                                    "such as the estop SDK example, to configure E-Stop."

    # Only one client at a time can operate a robot. Clients acquire a lease to
    # indicate that they want to control a robot. Acquiring may fail if another
    # client is currently controlling the robot. When the client is done
    # controlling the robot, it should return the lease so other clients can
    # control it. Note that the lease is returned as the "finally" condition in this
    # try-catch-finally block.
    # Create the lease client with keep-alive, then acquire the lease.
    lease_client = robot.ensure_client(bosdyn.client.lease.LeaseClient.default_service_name)
    lease_wallet = lease_client.lease_wallet
    lease = lease_client.acquire()
    bosdyn.client.lease.LeaseKeepAlive(lease_client)
    # Create robot command clients.
    command_client = robot.ensure_client(RobotCommandClient.default_service_name)
    # generate socket
    tcpClientSocket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    print('socket---%s' % tcpClientSocket)
    # connect server
    serverAddr = ('192.168.1.84', 9003)
    tcpClientSocket.connect(serverAddr)
    print('connect success!')
    # id for spot robot
    sendData = 'Spot1'
    # transfer to binary data
    sendData = sendData.encode('ascii')
    # send the id to tcp server
    tcpClientSocket.send(sendData)

    # set the initial velocity for robot movement
    velocitySpeed = VELOCITY_BASE_SPEED
    # set the initial body height for robot
    bodyHeight = BODY_HEIGHT
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
        if recvData['label'] == 'P':
            stand_park(bodyHeight)
        if recvData['label'] == '+':
            move_forward(velocitySpeed, bodyHeight)
        if recvData['label'] == 'H':
            bodyHeight = 0.1
            stand_higher(bodyHeight)
        if recvData['label'] == '-':
            move_backward(velocitySpeed, bodyHeight)
        if recvData['label'] == 'L':
            bodyHeight = -0.1
            stand_lower(bodyHeight)
        if recvData['label'] == '>':
            strafe_right(bodyHeight)
        if recvData['label'] == '>>':
            turn_right(bodyHeight)
        if recvData['label'] == '<':
            strafe_left(bodyHeight)
        if recvData['label'] == '<<':
            turn_left(bodyHeight)
        if recvData['label'] == '++':
            velocitySpeed = velocitySpeed + 0.1
            if velocitySpeed >= 1.0:
                velocitySpeed = 1.0
        if recvData['label'] == '--':
            velocitySpeed = velocitySpeed - 0.1
            if velocitySpeed <= 0.2:
                velocitySpeed = 0.3
        if recvData['label'] == 'Stand':
            stand_up()
        if recvData['label'] == 'Sit':
            sit_down()
        if recvData['label'] == 'PowerOn':
            power_on()
        if recvData['label'] == 'PowerOff':
            power_off()
        if recvData['label'] == 'StandNormal':
            bodyHeight = 0.0
            stand_normal(bodyHeight)
    # 关闭套接字
    tcpClientSocket.close()
    print('close socket!')
    lease_client.return_lease(lease)
    print('release client')
