'use strict'
var debugMode = ''

var audioBufferLength = 4096  // number of samples to collect per frame
var circularBufferLength = 	audioBufferLength*4
var triggerThreshold
var maxV
var minV
var maxROF = 25
var sensorDistance
var graphTriggerColor = 'lawngreen'
var thresholdHigh = 0.98
var rofResetTime = 5

var audioContext
var javascriptNode
var amplitudeArray = []
var amplitudeBuffer
var minValue
var maxValue

var lastProcessed = 0
var state = 0
var firstTrigger = 0
var secondTrigger
var triggers = []
var shots = []
var minTriggerDiff
var maxTriggerDiff
var resetDiff
var lastPoint
var lastShotBuffer

spacing.addEventListener('keyup', function() {
  var input = parseFloat(this.value)
  if (Number.isNaN(input) || input === 0 || typeof input !== 'number') {
    console.log('invalid input:')
    console.log(this.value)
  } else {
    console.log('valid input:')
    console.log(input)
    sensorDistance = input

		if (shots.length > 0) {
			for (var shoti = 0; shoti < shots.length; shoti++) {
				shots[shoti]['v'] = sensorDistance * audioContext.sampleRate / (shots[shoti][secondTrigger] - shots[shoti][firstTrigger])
			}
			updateStats()
		}
    minTriggerDiff = Math.round(sensorDistance * audioContext.sampleRate / maxV)
    maxTriggerDiff = Math.round(sensorDistance * audioContext.sampleRate / minV)
  }
})

threshold.addEventListener('keyup', function() {
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

vMinSetting.addEventListener('keyup', function() {
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

vMaxSetting.addEventListener('keyup', function() {
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
    {name: 'trigger', color: graphTriggerColor, data: [{x: 0, y: 0}, {x: circularBufferLength - 1, y: 0}]},
    {name: 'data', color: 'white', data: [{x: 0, y: 0}, {x: circularBufferLength - 1, y: 0}]}
  ]
})

graph1.series.addData({threshold: triggerThreshold})

window.requestAnimationFrame = (function () { // polyfill
	return window.requestAnimationFrame ||
	window.webkitRequestAnimationFrame ||
	window.mozRequestAnimationFrame ||
	function (callback, element) {
		window.setTimeout(callback, 1000 / 60)
	}
})()

graph1.render()
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

if (debugMode == "load") {
	var filename = "2018-03-02T11:56:56.345Z"
	console.log(Object.keys(localStorage))
	lastShotBuffer = JSON.parse(localStorage[filename])
	audioContext = {}
	audioContext.sampleRate = lastShotBuffer.sampleRate
	console.log(audioContext.sampeRate)
	console.log(lastShotBuffer)
	console.log(lastShotBuffer.length)
	console.log(lastShotBuffer.size)
	setupProcessor()
	amplitudeBuffer.length = lastShotBuffer.length
	amplitudeBuffer.size = lastShotBuffer.size
	amplitudeBuffer._array = lastShotBuffer._array
	processAudio()
	graph1.render()
	updateGraph2()
} else {
	console.log('normal operation, not loading from buffer')

	navigator.getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia) // Hacks to handle vendor prefixes
	window.AudioContext = (function () {return window.webkitAudioContext || window.AudioContext || window.mozAudioContext})()
	try {audioContext = new AudioContext()} catch (e) {console.err('Web Audio API is not supported in this browser')}

	var keyUpEvent = new Event('keyup')
	spacing.dispatchEvent(keyUpEvent)
	threshold.dispatchEvent(keyUpEvent)
	vMinSetting.dispatchEvent(keyUpEvent)
	vMaxSetting.dispatchEvent(keyUpEvent)
	console.log(sensorDistance, triggerThreshold, minV, maxV)

	navigator.mediaDevices.getUserMedia({
		video: false,
		audio: {
			channelCount: 1,
			sampleRate: 48000,
			volume: 1.0,
			echoCancellation: false
		}
	}).then(setupAudioNodes).catch(onError)
	drawGraph1()
}


function setupAudioNodes (stream) {
  var sourceNode = audioContext.createMediaStreamSource(stream)

  javascriptNode = audioContext.createScriptProcessor(audioBufferLength, 1, 1)

  javascriptNode.onaudioprocess = onAudioProcess

  sourceNode.connect(javascriptNode)
  javascriptNode.connect(audioContext.destination)
	setupProcessor()
}

function setupProcessor() {

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

function onAudioProcess(audioEvent) {
  amplitudeArray = audioEvent.inputBuffer.getChannelData(0)
  for (var i = 0; i < amplitudeArray.length; i++) {
    amplitudeBuffer.push(amplitudeArray[i])
  }
	processAudio()
}

function processAudio () {
  minValue = _.min(amplitudeBuffer._array)
  maxValue = _.max(amplitudeBuffer._array)
  for (; lastProcessed < amplitudeBuffer.length; lastProcessed++) {
	// trigger state machine
	// 0 = waiting for first trigger
	// 1 = triggered, waiting for second
	// 2 =  triggered twice, waiting for reset
    if (state === 2 && lastProcessed - firstTrigger > resetDiff) {
      updateGraph2()
      state = 0
    }
    if (state === 0 || state === 1) {
      if (lastProcessed > 0) {
        lastPoint = amplitudeBuffer.get(lastProcessed - 1)
      } else {
        lastPoint = 0
      }
      var aboveThreshold = amplitudeBuffer.get(lastProcessed) > triggerThreshold
      var previouslyBelowThreshold = lastPoint < triggerThreshold
      var notTooFast = lastProcessed - firstTrigger > minTriggerDiff

      if (state === 1 && lastProcessed - firstTrigger > maxTriggerDiff) { // timeout
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
      } else if (aboveThreshold && previouslyBelowThreshold && notTooFast) { // if valid trigger
				triggers.push(lastProcessed)
        if (state === 0) {
          console.log('first trigger')
          state = 1
          firstTrigger = lastProcessed
          secondTrigger = undefined
        } else { // state == 1
          console.log('second trigger')
          state = 2
          secondTrigger = lastProcessed
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
	console.log(minValue, maxValue)
	triggers = _.dropWhile(triggers, function(o) { return o < amplitudeBuffer.length - amplitudeBuffer.size})
	console.log(triggers)
	console.log(amplitudeBuffer.length-amplitudeBuffer.size, amplitudeBuffer.length)
  graph2.series[1].data = bufferToSeries(amplitudeBuffer)
  graph2.series[0].data = [{x: Math.max(0, amplitudeBuffer.length - amplitudeBuffer.size), y: triggerThreshold}]
	_.forEach(triggers, function(trigger, i) {
		graph2.series[0].data.push(
			{x: trigger - 1, y: triggerThreshold},
			{x: trigger, y: thresholdHigh},
			{x: trigger + minTriggerDiff, y: thresholdHigh},
			{x: trigger + minTriggerDiff + 1, y: triggerThreshold}
		)
	})
	graph2.series[0].data.push({x: amplitudeBuffer.length, y: graph2.series[0].data[graph2.series[0].data.length-1].y})
	console.log(graph2.series[0].data)
  if (secondTrigger === undefined) {
    console.log("graphing timeout");
  } else {
    console.log("graphing valid");
  }
//    console.log(JSON.stringify(graph2.series[0].data));
	if (debugMode == "save") {
	  lastShotBuffer = amplitudeBuffer
	}
  graph2.render()
}

function bufferToSeries () {
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
  requestAnimationFrame(drawGraph1)
}

function saveBuffer(name) {
	if (debugMode != "save") {
		console.log('not in save mode')
		return
	}
	if (typeof(Storage) !== "undefined") {
		if (name == undefined) {
  		var filename = new Date().toISOString()
		} else {
  		var filename = new Date().toISOString()+'-'+name
		}
		console.log(filename)
		console.log(_.min(lastShotBuffer._array),_.min(lastShotBuffer._array))
		lastShotBuffer.sampleRate = audioContext.sampleRate
		localStorage[filename] = JSON.stringify(lastShotBuffer)
		return filename
	} else {
		console.log('no Storage support')
	}
}

function stdDev (array) {
  var avg = _.sum(array) / array.length
  return Math.sqrt(_.sum(_.map(array, (i) => Math.pow((i - avg), 2))) / array.length)
};

console.log('end of file')
