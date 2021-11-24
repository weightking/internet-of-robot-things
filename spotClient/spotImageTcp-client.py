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
import threading
from scipy import ndimage

source = ['left_fisheye_image']

ROTATION_ANGLE = {
    'back_fisheye_image': 0,
    'frontleft_fisheye_image': -90,
    'frontright_fisheye_image': -90,
    'left_fisheye_image': 0,
    'right_fisheye_image': 180
}

def receive_source(new_client):
    while True:
        # receive data
        recvData = new_client.recv(1024)
        # transfer to string
        recvData = recvData.decode('ascii')
        # transfer to json object
        recvData = json.loads(recvData)
        # print the received data
        print('the receive message is:%s' % recvData['label'])
        if recvData['label'] == 'frontleft_fisheye_image':
            source[0] = 'frontleft_fisheye_image'
        if recvData['label'] == 'frontright_fisheye_image':
            source[0] = 'frontright_fisheye_image'
        if recvData['label'] == 'left_fisheye_image':
            source[0] = 'left_fisheye_image'
        if recvData['label'] == 'right_fisheye_image':
            source[0] = 'right_fisheye_image'
        if recvData['label'] == 'back_fisheye_image':
            source[0] = 'back_fisheye_image'
    new_client.close()


def get_image(source, new_client, image_client):
    while True:
        image = image_client.get_image_from_sources([source[0]])[0]
        dtype = np.uint8
        img = np.frombuffer(image.shot.image.data, dtype=dtype)
        img = cv2.imdecode(img, -1)
        img = ndimage.rotate(img, ROTATION_ANGLE[source[0]])
        img = img.reshape(-1)
        img = img.tobytes()
        new_client.send(img)
    new_client.close()

if __name__ == '__main__':
    # The Boston Dynamics Python library uses Python's logging module to
    # generate output. Applications using the library can specify how
    # the logging information should be output.
    bosdyn.client.util.setup_logging()
    # The SDK object is the primary entry point to the Boston Dynamics API.
    # create_standard_sdk will initialize an SDK object with typical default
    # parameters. The argument passed in is a string identifying the client.
    sdk = bosdyn.client.create_standard_sdk('spotTcpClient2')
    # A Robot object represents a single robot. Clients using the Boston
    # Dynamics API can manage multiple robots, but this tutorial limits
    # access to just one. The network address of the robot needs to be
    # specified to reach it. This can be done with a DNS name
    # (e.g. spot.intranet.example.com) or an IP literal (e.g. 10.0.63.1)
    robot = sdk.create_robot('192.168.10.10')
    # Clients need to authenticate to a robot before being able to use it.
    robot.authenticate('duo', 'MISSyou1230jin')
    robot.sync_with_directory()
    # Establish time sync with the robot. This kicks off a background thread to establish time sync.
    # Time sync is required to issue commands to the robot. After starting time sync thread, block
    # until sync is established.
    robot.time_sync.wait_for_sync()

    # generate socket
    tcpClientSocket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    print('socket---%s' % tcpClientSocket)
    # connect server
    serverAddr = ('192.168.10.129', 9003)
    tcpClientSocket.connect(serverAddr)
    print('connect success!')
    # id for spot robot
    sendData = 'Spot1Video'
    # transfer to binary data
    sendData = sendData.encode('ascii')
    # send the id to tcp server
    tcpClientSocket.send(sendData)

    image_client = robot.ensure_client(ImageClient.default_service_name)
    sub_thread1 = threading.Thread(target=receive_source, args=(tcpClientSocket,))
    sub_thread2 = threading.Thread(target=get_image, args=(source, tcpClientSocket, image_client))
    sub_thread1.start()
    sub_thread2.start()
