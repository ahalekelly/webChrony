'use strict';
var bufferLength = 512  // number of samples to collect per frame
var triggerThreshold = 0.2
var maxV = 300
var minV = 10
var sensorDistance = 1.125

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
var amplitudeArray     // array to hold sound data
var minValue
var maxValue

// Global Variables for Drawing
var column = 0

// Global variables for chrony
var sampleCounter = 0
var triggers = []
var shots = []
var firstTrigger
var velocities = []
var minTriggerDiff
var maxTriggerDiff

var mouseDown = false

//document.addEventListener("DOMContentLoaded", function() {
var canvas1 = document.getElementById("canvas1")
var canvas2 = document.getElementById("canvas2")

try {
	audioContext = new AudioContext()
	} catch (e) {
	console.err('Web Audio API is not supported in this browser')
}

var graphHeight = canvas1.offsetHeight
var graphWidth = canvas1.offsetWidth
var graph1 = new Rickshaw.Graph( {
	element: canvas1,
	width: graphWidth,
	height: graphHeight,
	renderer: 'line',
	min: 0,
	max: 1.0,	
	series: new Rickshaw.Series.FixedDuration([{name:"threshold",color:"lawngreen"},{ name: 'data', color:"white"}], undefined, {
		timeInterval: 2000/graphWidth,
		maxDataPoints: graphWidth,
		timeBase: new Date().getTime() / 1000
	}) 
});

graph1.series.addData({threshold:triggerThreshold})

canvas1.onmousedown = mouseDownHandler
canvas2.onmousedown = mouseDownHandler
document.onmouseup = mouseUpHandler

function mouseDownHandler(e) {
	var rect = this.getBoundingClientRect();
	this.onmousemove = moveHandler
	console.log("mouseDown")
	console.log(e)
	triggerThreshold = (rect.height - e.clientY - rect.top)/rect.height;
	console.log(triggerThreshold)
}

function mouseUpHandler(e) {
	console.log("mouseUp")
	canvas1.onmousemove = null
	canvas2.onmousemove = null
}

function moveHandler(e){
	var rect = this.getBoundingClientRect();
	triggerThreshold = (rect.height - e.clientY - rect.top)/rect.height;
}

graph1.render();
//	graph2.render();
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
//})

function setupAudioNodes (stream) {
	var sourceNode = audioContext.createMediaStreamSource(stream)
	
	javascriptNode = audioContext.createScriptProcessor(bufferLength, 1, 1)
	
	javascriptNode.onaudioprocess = processAudio
	
	sourceNode.connect(javascriptNode)
	javascriptNode.connect(audioContext.destination)
	
	minTriggerDiff = Math.round(sensorDistance * audioContext.sampleRate / maxV)
	maxTriggerDiff = Math.round(sensorDistance * audioContext.sampleRate / minV)
	triggers = [-maxTriggerDiff]
	
	console.log(audioContext.sampleRate, minTriggerDiff, maxTriggerDiff)
}

function onError (e) {
	console.log(e)
}

function processAudio (audioEvent) {
	amplitudeArray = audioEvent.inputBuffer.getChannelData(0)
	//  requestAnimFrame(drawChart)
	minValue = _.min(amplitudeArray)
	maxValue = _.max(amplitudeArray)
	for (var i = 0; i < amplitudeArray.length; i++) {
		if (i + sampleCounter > firstTrigger + maxTriggerDiff) {
			firstTrigger = undefined
			vReading.innerHTML = 'Timeout'
			console.log('Error: timeout')
			shotsDiv.insertAdjacentHTML('afterbegin','<h2>Timeout</h2>')
		}
		if (amplitudeArray[i] > triggerThreshold && sampleCounter + i - triggers[triggers.length - 1] > minTriggerDiff) {
			if (firstTrigger === undefined) {
				console.log('first trigger')
				firstTrigger = sampleCounter + i
				triggers.push(sampleCounter + i)
				} else {
				console.log('second trigger')
				var triggerDiff = sampleCounter + i - triggers[triggers.length - 1]
				var v = sensorDistance * audioContext.sampleRate / triggerDiff
				triggers.push(sampleCounter + i)
				var rof = audioContext.sampleRate/(sampleCounter+i-shots[shots.length-1])
				shots.push(sampleCounter + i)
				shotsDiv.insertAdjacentHTML('afterbegin','<h2>'+v.toPrecision(3)+' fps ' + (rof > 0.1 ? rof.toPrecision(3) + " rps" : "") +'</h2>')
				velocities.push(v)
				firstTrigger = undefined
				vReading.innerHTML = v.toPrecision(3)
			}
		}
	}
	graph1.series.addData({data:maxValue, threshold:triggerThreshold});
	graph1.render();				
	
	sampleCounter += bufferLength
}
