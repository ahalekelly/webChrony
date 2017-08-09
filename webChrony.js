'use strict'
var audioBufferLength = 4096  // number of samples to collect per frame
var circularBufferLength = 	8192
var triggerThreshold = 0.2
var maxV = 300
var minV = 10
var maxROF = 25
var sensorDistance = 1.125
var graphTriggerColor = 'lawngreen'
var thresholdHigh = 0.98
var rofResetTime = 5

var audioContext
var javascriptNode
var amplitudeArray = []
var amplitudeBuffer
var minValue
var maxValue

var state = 0
var firstTrigger = 0
var secondTrigger
var shots = []
var minTriggerDiff
var maxTriggerDiff
var resetDiff
var lastPoint

// Hacks to handle vendor prefixes
navigator.getUserMedia = (navigator.getUserMedia ||
navigator.webkitGetUserMedia ||
navigator.mozGetUserMedia ||
navigator.msGetUserMedia)

window.requestAnimFrame = (function () {
  return window.requestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  function (callback, element) {
    window.setTimeout(callback, 1000 / 60)
  }
})()

window.AudioContext = (function () {
  return window.webkitAudioContext || window.AudioContext || window.mozAudioContext
})()

document.getElementById('spacing').addEventListener('keyup', function () {
  var input = parseFloat(this.value)
  if (Number.isNaN(input) || input === 0 || typeof input !== 'number') {
    console.log('invalid input:')
    console.log(this.value)
  } else {
    console.log('valid input:')
    console.log(input)
    sensorDistance = input

    for (var shoti = 0; shoti < shots.length; shoti++) {
      shots[shoti]['v'] = sensorDistance * audioContext.sampleRate / (shots[shoti][secondTrigger] - shots[shoti][firstTrigger])
    }
    minTriggerDiff = Math.round(sensorDistance * audioContext.sampleRate / maxV)
    maxTriggerDiff = Math.round(sensorDistance * audioContext.sampleRate / minV)
    updateStats()
  }
})
document.getElementById('threshold').addEventListener('keyup', function () {
  var input = parseFloat(this.value)
  if (Number.isNaN(input) || input === 0 || typeof input !== 'number') {
    console.log('invalid input:')
    console.log(this.value)
  } else {
    console.log('valid input:')
    console.log(input)
    triggerThreshold = input
  }
})
document.getElementById('vMinSetting').addEventListener('keyup', function () {
  var input = parseFloat(this.value)
  if (Number.isNaN(input) || input === 0 || typeof input !== 'number') {
    console.log('invalid input:')
    console.log(this.value)
  } else {
    console.log('valid input:')
    console.log(input)
    minV = input
    minTriggerDiff = Math.round(sensorDistance * audioContext.sampleRate / maxV)
  }
})
document.getElementById('vMaxSetting').addEventListener('keyup', function () {
  var input = parseFloat(this.value)
  if (Number.isNaN(input) || input === 0 || typeof input !== 'number') {
    console.log('invalid input:')
    console.log(this.value)
  } else {
    console.log('valid input:')
    console.log(input)
    maxV = input
    maxTriggerDiff = Math.round(sensorDistance * audioContext.sampleRate / minV)
  }
})

var canvas1 = document.getElementById('canvas1')
var canvas2 = document.getElementById('canvas2')

var vLast = document.getElementById('vLast')
var vAvg = document.getElementById('vAvg')
var vMin = document.getElementById('vMin')
var vMax = document.getElementById('vMax')
var vStdDev = document.getElementById('vStdDev')

var rofLast = document.getElementById('rofLast')
var rofAvg = document.getElementById('rofAvg')
var rofMin = document.getElementById('rofMin')
var rofMax = document.getElementById('rofMax')
var rofStdDev = document.getElementById('rofStdDev')

var shotsTable = new Vue({
  el: '#shots',
  filters: {
    round: function (value, precision) {
      if (typeof value === 'number' && Number.isNaN(value) === false) {
        if (!precision) {
          precision = 0
        }
        value = value.toPrecision(precision)
      }
      return value
    }
  },
  data: {
    message: 'test',
    shots: shots
  }
})

try {
  audioContext = new AudioContext()
} catch (e) {
  console.err('Web Audio API is not supported in this browser')
}

var graph1 = new Rickshaw.Graph({
  element: canvas1,
  width: canvas1.offsetWidth,
  height: canvas1.offsetHeight,
  renderer: 'line',
  interpolation: 'linear',
  min: -1,
  max: 1,
  series: new Rickshaw.Series.FixedDuration([
    {name: 'threshold', color: graphTriggerColor},
    {name: 'data', color: 'white'}
  ], undefined, {
    timeInterval: 2000 / canvas1.offsetWidth,
    maxDataPoints: canvas1.offsetWidth,
    timeBase: new Date().getTime() / 1000
  })
})

var graph2 = new Rickshaw.Graph({
  element: canvas2,
  width: canvas2.offsetWidth,
  height: canvas2.offsetHeight,
  renderer: 'line',
  interpolation: 'linear',
  min: -1,
  max: 1,
  series: [
    {name: 'trigger', color: graphTriggerColor, data: [{x: 0, y: triggerThreshold}, {x: circularBufferLength - 1, y: triggerThreshold}]},
    {name: 'data', color: 'white', data: [{x: 0, y: 0}, {x: circularBufferLength - 1, y: 0}]}
  ]
})

graph1.series.addData({threshold: triggerThreshold})

drawGraph1()
graph2.render()

window.onresize = function () {
  graph1.configure({
    width: canvas1.offsetWidth,
    height: canvas1.offsetHeight
  })
  graph2.configure({
    width: canvas2.offsetWidth,
    height: canvas2.offsetHeight
  })
}

canvas1.onmousedown = mouseDownHandler
canvas2.onmousedown = mouseDownHandler
document.onmouseup = mouseUpHandler

function mouseDownHandler (e) {
  var rect = this.getBoundingClientRect()
  this.onmousemove = moveHandler
  console.log(this)
  console.log(e.clientY, rect.top)
  console.log(e.clientY - rect.top)
  console.log('mouseDown')
  console.log(e)
//  triggerThreshold = (rect.height - (e.clientY - rect.top))/rect.height;
  triggerThreshold = Math.max(0.01, (rect.height / 2 - (e.clientY - rect.top)) / (rect.height / 2))
  console.log(triggerThreshold)
}

function mouseUpHandler (e) {
  //  console.log("mouseUp")
  canvas1.onmousemove = null
  canvas2.onmousemove = null
}

function moveHandler (e) {
  console.log('mouseMove')
  var rect = this.getBoundingClientRect()
  triggerThreshold = Math.max(0.01, (rect.height / 2 - (e.clientY - rect.top)) / (rect.height / 2))
}

/*
  var iv = setInterval( function() {
  var data = { data: Math.floor(Math.random() * 40) };
  graph1.series.addData(data);
  graph1.render();
  }, 250 );
*/
navigator.mediaDevices.getUserMedia({
  video: false,
  audio: {
    channelCount: 1,
    sampleRate: 48000,
    volume: 1.0,
    echoCancellation: false
  }
}).then(setupAudioNodes).catch(onError)

function setupAudioNodes (stream) {
  var sourceNode = audioContext.createMediaStreamSource(stream)

  javascriptNode = audioContext.createScriptProcessor(audioBufferLength, 1, 1)

  javascriptNode.onaudioprocess = processAudio

  sourceNode.connect(javascriptNode)
  javascriptNode.connect(audioContext.destination)

  minTriggerDiff = Math.round(sensorDistance * audioContext.sampleRate / maxV)
  maxTriggerDiff = Math.round(sensorDistance * audioContext.sampleRate / minV)
  amplitudeBuffer = new CircularBuffer(circularBufferLength)
  resetDiff = Math.round(audioContext.sampleRate / maxROF)

  console.log(audioContext.sampleRate, minTriggerDiff, maxTriggerDiff)
}

function onError (e) {
  console.log(e)
}

function calculateRof (i) {
  if (i === undefined) {
    i = shots.length - 1
  }
  if (i > 0) {
    var rof = audioContext.sampleRate / (shots[i].firstTrigger - shots[i - 1].firstTrigger)
    if (1 / rof > rofResetTime) {
      rof = null
      rofLast.innerHTML = 0
    } else {
      rofLast.innerHTML = rof.toPrecision(3)
    }
  } else {
    rof = null
    rofLast.innerHTML = 0
  }
  return rof
}

function processAudio (audioEvent) {
  amplitudeArray = audioEvent.inputBuffer.getChannelData(0)
  for (var i = 0; i < amplitudeArray.length; i++) {
    amplitudeBuffer.push(amplitudeArray[i])
  }
  minValue = _.min(amplitudeBuffer._array)
  maxValue = _.max(amplitudeBuffer._array)
  for (var i = amplitudeBuffer.length - audioBufferLength; i < amplitudeBuffer.length; i++) {
    if (state === 2 && i - firstTrigger > resetDiff) {
//      console.log('reset');
      updateGraph2()
      state = 0
    }
    if (state === 0 || state === 1) {
      if (i > 0) {
        lastPoint = amplitudeBuffer.get(i - 1)
      } else {
        lastPoint = 0
      }
      var aboveThreshold = amplitudeBuffer.get(i) > triggerThreshold
      var previouslyBelowThreshold = lastPoint < triggerThreshold
      var notTooFast = i - firstTrigger > minTriggerDiff

      if (state === 1 && i - firstTrigger > maxTriggerDiff) { // timeout
        vLast.innerHTML = 'Timeout'
        graph2.series[1].color = 'red'
        console.log('timeout')
        if (typeof rof === 'number') {
          shots.push({
            firstTrigger: firstTrigger,
            secondTrigger: null,
            v: null,
            rof: null
          })
          calculateRof()
          if (shots[shots.length - 1].rof === null) {
            shots.splice(shots.length - 1, 1)
          }
        }
        state = 0
        updateGraph2()
      } else if (aboveThreshold && previouslyBelowThreshold && notTooFast) {
        if (state === 0) {
          console.log('first trigger')
          state = 1
          firstTrigger = i
          secondTrigger = undefined
        } else { // state == 1
          console.log('second trigger')
          state = 2
          secondTrigger = i
          var v = sensorDistance * audioContext.sampleRate / (secondTrigger - firstTrigger)

          shots.push({
            firstTrigger: firstTrigger,
            secondTrigger: secondTrigger,
            v: v,
            rof: null
          })

          calculateRof()
          updateStats()
          graph2.series[1].color = 'white'
        }
      }
    }
  }
  graph1.series.addData({data: maxValue, threshold: triggerThreshold})
  graph1.series.addData({data: minValue, threshold: triggerThreshold})
}

function updateStats () {
  vLast.innerHTML = shots[shots.length - 1].v.toPrecision(3)
  vAvg.innerHTML = _.meanBy(shots, 'v').toPrecision(3)
  vMin.innerHTML = _.minBy(shots, 'v').v.toPrecision(3)
  vMax.innerHTML = _.maxBy(shots, 'v').v.toPrecision(3)
// vStdDev.innerHTML = stdDev(shots, 'v').toPrecision(3) // TODO stdDevBy

  if (shots[shots.length - 1].rof === null) {
    rofLast.innerHTML = 0
  } else {
    rofLast.innerHTML = shots[shots.length - 1].rof.toPrecision(3)
    rofAvg.innerHTML = _.meanBy(shots, 'rof').toPrecision(3)
    rofMin.innerHTML = _.minBy(shots, 'rof').rof.toPrecision(3)
    rofMax.innerHTML = _.maxBy(shots, 'rof').rof.toPrecision(3)
//  rofStdDev.innerHTML = stdDev(shots, 'rof').toPrecision(3) // TODO stdDevBy
  }
}

function updateGraph2 () {
  console.log('updateGraph2')
  graph2.series[1].data = bufferToSeries(amplitudeBuffer)
  graph2.series[0].data = [
      {x: Math.max(0, amplitudeBuffer.length - amplitudeBuffer.size), y: triggerThreshold},
      {x: firstTrigger - 1, y: triggerThreshold},
      {x: firstTrigger, y: thresholdHigh},
      {x: firstTrigger + minTriggerDiff, y: thresholdHigh},
      {x: firstTrigger + minTriggerDiff + 1, y: triggerThreshold}
  ]
  if (secondTrigger === undefined) {
//      console.log("graphing timeout");
    graph2.series[0].data = graph2.series[0].data.concat([
        {x: amplitudeBuffer.length, y: triggerThreshold}
    ])
  } else {
//      console.log("graphing valid");
    graph2.series[0].data = graph2.series[0].data.concat([
        {x: secondTrigger - 1, y: triggerThreshold},
        {x: secondTrigger, y: thresholdHigh},
        {x: amplitudeBuffer.length, y: thresholdHigh}
    ])
  }
//    console.log(JSON.stringify(graph2.series[0].data));
  graph2.render()
}

function bufferToSeries (inputArrays) {
  var series = []
  for (var i = Math.max(0, amplitudeBuffer.length - amplitudeBuffer.size); i < amplitudeBuffer.length; i++) {
    series.push({x: i, y: amplitudeBuffer.get(i)})
  }
  return series
}

function deleteShot (e) {
  console.log('deleteShot')
  var shoti = _.findIndex(shots, {firstTrigger: parseInt(e.id)})
  shots.splice(shoti, 1)
  calculateRof(shoti)
}

function drawGraph1 () {
//  console.log("drawGraph1");
  graph1.render()
  requestAnimFrame(drawGraph1)
}

// Circular buffer storage. Externally-apparent 'length' increases indefinitely
// while any items with indexes below length-n will be forgotten (undefined
// will be returned if you try to get them, trying to set is an exception).
// n represents the initial length of the array, not a maximum
function CircularBuffer (n) {
  this._array = new Array(n)
  this.length = 0
  this.size = n
}
CircularBuffer.prototype.toString = function () {
  return '[object CircularBuffer(' + this._array.length + ') length ' + this.length + ']'
}
CircularBuffer.prototype.get = function (i) {
  if (i < 0 || i < this.length - this._array.length) { return undefined }
  return this._array[i % this._array.length]
}
CircularBuffer.prototype.push = function (v) {
  this._array[this.length % this._array.length] = v
  this.length++
}
CircularBuffer.prototype.set = function (i, v) {
  if (i < 0 || i < this.length - this._array.length) { throw CircularBuffer.IndexError }
  while (i > this.length) {
    this._array[this.length % this._array.length] = undefined
    this.length++
  }
  this._array[i % this._array.length] = v
  if (i === this.length) { this.length++ }
}
CircularBuffer.IndexError = {}

function stdDev (array) {
  var avg = _.sum(array) / array.length
  return Math.sqrt(_.sum(_.map(array, (i) => Math.pow((i - avg), 2))) / array.length)
};
