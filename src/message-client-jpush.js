/**
 * Created by colinhan on 14/03/2017.
 */

import JPushModule from 'jpush-react-native';
import client from 'p2m-message-client';

var { NativeAppEventEmitter, Platform } = require('react-native');

const channelId = 'jpush';
let _options;
let subscription;

function channel(options) {
  let events = {};
  let isConnected = false;
  let rememberMessages = {};

  function on(event, callback) {
    let list = events[event] = events[event] || [];
    list.push({ cb: callback });

    if (event === 'connect') {
      if (isConnected) {
        callback(this);
      }
    }
    return this;
  }
  function off(event, callback) {
    let list = events[event];

    if (list == null) {
      console.error('[JPUSH] specified callback is not found in event list ' + event);
      return;
    }

    let found = false;
    for (let i = 0; i < list.length; i++) {
      if (list[i].cb === callback) {
        list.splice(i, 1);
        found = true;
        i--;
      }
    }

    if (!found) {
      console.error('[JPUSH] specified callback is not found in event list ' + event);
    }
  }
  function emit(event, ...params) {
    let list = events[event];
    if (list) {
      list.map(e => e.cb.apply(null, params));
    }
  }

  function start(opt2) {
    let self = this;
    _options = Object.assign({}, options, opt2);

    console.log("[JPUSH] JPUSH client is starting...");
    if(Platform.OS === 'ios') {
      subscription = NativeAppEventEmitter.addListener('ReceiveNotification',onMessage.bind(this));
      NativeAppEventEmitter.addListener('OpenNotification',onOpenMessage.bind(this));
    } else {
      JPushModule.addReceiveNotificationListener(onMessage.bind(this));
      JPushModule.addReceiveOpenNotificationListener(onOpenMessage.bind(this));
    }

    JPushModule.getRegistrationID(function (deviceId) {
      client.register(_options.userId, deviceId, channelId).then(function () {
        emit('connect', self);
      });
    });
  }
  function stop(opt2) {
    let self = this;
    _options = Object.assign({}, options, opt2);

    console.log(`[JPUSH] Stopping service...`);
    if(Platform.OS === 'ios') {
      subscription.remove();
    } else {
      JPushModule.removeReceiveNotificationListener(onMessage);
    }

    console.log("[JPUSH] JPUSH client is unregisting...");
    JPushModule.getRegistrationID(function (deviceId) {
      client.unRegister(_options.userId, deviceId, channelId);
    });

    emit('disconnect', this);
  }

  function onMessage(map) {
    console.log(`[JPUSH] Got a message`);
    let fullPath = _options.serverUrl + _options.path;
    let message;
    if(Platform.OS === 'ios') {
      message = map;
      //console.log(`[JPUSH] Set message as delivered success.`);
    } else {
      message = JSON.parse(map.extras);
    }
    //let notificationId = map.notificationId;
    fetch(`${fullPath}/delivered`, {
      method: 'post',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pushId: message.pushId }),
      credentials: 'include'
    }).then(res => {
      if (!res.ok) {
        let err = `Set message as delivered failed with error state ${res.state}`;
        console.error(`[JPUSH] ${err}`);
        throw err;
      }

      return res.json();
    }).then(result => {
      if (result.success) {
        console.log(`[JPUSH] Set message as delivered success.`);
      } else {
        let err = `Set message as delivered failed with error ${result.error}`;
        console.error('[JPUSH] ' + err);
        throw err;
      }
    });
    emit('message', message, this);
  }
  function onOpenMessage(map) {
    console.log(`[JPUSH] User press the message on notification panel.`);
    let message;
    if(Platform.OS === 'ios') {
      message = map;
    } else {
      message = JSON.parse(map.extras);
    }
    delete rememberMessages[message.sendId];
    client.read(message.sendId);
    emit('openMessage', message, this);
  }

  function forgetMessage(sendId) {
    let notificationId = rememberMessages[sendId];
    if (notificationId) {
      // TODO: For now, jpush-react-native does not provider clearNotificationById method.
    }
  }

  return { start, stop, on, off, forgetMessage, channelId };
}

module.exports = channel;
