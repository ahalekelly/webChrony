'use strict'
var bufferLength = 512  // number of samples to collect per frame
var circularBufferLength = 12
var triggerThreshold = 0.2
var maxV = 300
var minV = 10
var maxROF = 30
var sensorDistance = 1.125
var graphTriggerColor = 'lawngreen'
var graph2UpdateInterval = 1000
var thresholdHigh = 0.98

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

// Global Variables for Audio
var audioContext
var javascriptNode
var amplitudeArray = []    // array to hold sound data
var amplitudeArrayBuffer = new CircularBuffer(circularBufferLength)
var minValue
var maxValue

var state = 0
var sampleCounter = 0
var triggers = []
var shots = []
var firstTrigger = 0
var secondTrigger
var velocities = []
var minTriggerDiff
var maxTriggerDiff
var resetDiff
var lastPoint

var canvas1 = document.getElementById('canvas1')
var canvas2 = document.getElementById('canvas2')
var vReading = document.getElementById('vAvg')

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
    {name: 'trigger', color: graphTriggerColor, data: [{x: 0, y: triggerThreshold}, {x: bufferLength * circularBufferLength - 1, y: triggerThreshold}]},
    {name: 'data', color: 'white', data: [{x: 0, y: 0}, {x: bufferLength * circularBufferLength - 1, y: 0}]}
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

  javascriptNode = audioContext.createScriptProcessor(bufferLength, 1, 1)

  javascriptNode.onaudioprocess = processAudio

  sourceNode.connect(javascriptNode)
  javascriptNode.connect(audioContext.destination)

  minTriggerDiff = Math.round(sensorDistance * audioContext.sampleRate / maxV)
  maxTriggerDiff = Math.round(sensorDistance * audioContext.sampleRate / minV)
  resetDiff = Math.round(audioContext.sampleRate / maxROF)
  triggers = [-maxTriggerDiff]

  console.log(audioContext.sampleRate, minTriggerDiff, maxTriggerDiff)
}

function onError (e) {
  console.log(e)
}

function processAudio (audioEvent) {
//  console.log("processAudio");
  amplitudeArray = audioEvent.inputBuffer.getChannelData(0)
//  console.log(amplitudeArray[0]);
  amplitudeArrayBuffer.enq(_.cloneDeep(amplitudeArray));
  minValue = _.min(amplitudeArray)
  maxValue = _.max(amplitudeArray)
  for (var i = 0; i < amplitudeArray.length; i++) {
    if (state === 2 && sampleCounter + i - firstTrigger > resetDiff) {
      console.log('reset');
      state = 0;
    }
    if (state === 0 || state === 1) {
		  if (i > 0) {
			  lastPoint = amplitudeArray[i-1]
			} else {
			  if (amplitudeArrayBuffer.size() > 1) {
					lastPoint = amplitudeArrayBuffer.get(1)[bufferLength-1]
				} else {
				  lastPoint = 0
				}
			}
      var aboveThreshold = amplitudeArray[i] > triggerThreshold ;
      var previouslyBelowThreshold = lastPoint < triggerThreshold;
      var notTooFast = (sampleCounter + i) - firstTrigger > minTriggerDiff;
			if (state === 1 && sampleCounter + i - firstTrigger > maxTriggerDiff) { // timeout
		//      vReading.innerHTML = 'Timeout'
		//      shotsDiv.insertAdjacentHTML('afterbegin','<h2>Timeout</h2>')
			  graph2.series[1].color = 'red'
			  console.log('timeout')
        state = 0
				updateGraph2(amplitudeArrayBuffer.toarray())
			} else if (aboveThreshold && previouslyBelowThreshold && notTooFast) {
			  if (state === 0) {
		  		console.log('first trigger')
				  state = 1;
					firstTrigger = sampleCounter + i
					secondTrigger = undefined;
					triggers.push(sampleCounter + i)
			  } else { // state == 1
					console.log('second trigger')
					state = 2;
					secondTrigger = sampleCounter+i
					var triggerDiff = sampleCounter + i - triggers[triggers.length - 1]
					var v = sensorDistance * audioContext.sampleRate / triggerDiff
					triggers.push(sampleCounter + i)
					var rof = audioContext.sampleRate / (sampleCounter + i - shots[shots.length - 1])
					shots.push(sampleCounter + i)
			//        shotsDiv.insertAdjacentHTML('afterbegin','<h2>'+v.toPrecision(3)+' fps ' + (rof > 0.1 ? rof.toPrecision(3) + " rps" : "") +'</h2>')
					velocities.push(v)
					vReading.innerHTML = v.toPrecision(3)
					graph2.series[1].color = 'white'
					updateGraph2(amplitudeArrayBuffer.toarray())
			  }
			}
    }
  }
  graph1.series.addData({data: maxValue, threshold: triggerThreshold})
  graph1.series.addData({data: minValue, threshold: triggerThreshold})
  sampleCounter += bufferLength
}

function updateGraph2 (inputArrays) {
  console.log("updateGraph2");
    inputArrays.reverse();
    graph2.series[1].data = arraysToSeries(inputArrays)
    graph2.series[0].data = [
      {x: sampleCounter - bufferLength * (circularBufferLength - 1), y: triggerThreshold},
      {x: firstTrigger-1, y: triggerThreshold},
      {x: firstTrigger, y: thresholdHigh},
      {x: firstTrigger+minTriggerDiff, y: thresholdHigh},
      {x: firstTrigger+minTriggerDiff+1, y: triggerThreshold}
    ]
    if (secondTrigger === undefined) {
      graph2.series[0].data = graph2.series[0].data.concat([
        {x: sampleCounter + bufferLength - 1, y: triggerThreshold}
      ]);
    } else {
      graph2.series[0].data = graph2.series[0].data.concat([
        {x: secondTrigger-1, y: triggerThreshold},
        {x: secondTrigger, y: thresholdHigh},
        {x: sampleCounter + bufferLength - 1, y: thresholdHigh}
      ]);
    }
    graph2.render()
}

function arraysToSeries (inputArrays) {
  console.log("arraysToSeries");
  var series = []
  var i = sampleCounter - bufferLength * (circularBufferLength - 1)
  for (var whichArray=0; whichArray < inputArrays.length; whichArray++) {
    for (var arrayPos=0; arrayPos < inputArrays[whichArray].length; arrayPos++) {
      series.push({x: i, y: inputArrays[whichArray][arrayPos]})
      i++
    }
  }
  return series
}

function drawGraph1 () {
//  console.log("drawGraph1");
  graph1.render()
  requestAnimFrame(drawGraph1)
}
