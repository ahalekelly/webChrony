var bufferLength = 2048  // number of samples to collect per frame
var triggerThreshold = 0.5
var maxV = 500
var minV = 1
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
var canvas = document.getElementById('canvas')
var vReading = document.getElementById('velocity')
var shotsDiv = document.getElementById('shotTable')
console.log(shotsDiv)
var ctx = canvas.getContext('2d')

// Global variables for chrony
var sampleCounter = 0
var triggers = []
var shots = []
var firstTrigger
var velocities = []
var minTriggerDiff
var maxTriggerDiff

try {
  audioContext = new AudioContext()
} catch (e) {
  console.err('Web Audio API is not supported in this browser')
}

clearCanvas()

navigator.mediaDevices.getUserMedia({
  video: false,
//  audio:true
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
  triggers = [-maxTriggerDiff]

  console.log(audioContext.sampleRate, minTriggerDiff, maxTriggerDiff)
}

function onError (e) {
  console.log(e)
}

function processAudio (audioEvent) {
  amplitudeArray = audioEvent.inputBuffer.getChannelData(0)
  requestAnimFrame(drawChart)
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
      break
    }
  }
  sampleCounter += bufferLength
}

function drawChart () {
  var yLow = canvas.height - (canvas.height * (minValue / 2 + 0.5)) - 1
  var yHigh = canvas.height - (canvas.height * (maxValue / 2 + 0.5)) - 1

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(column, yLow, 1, yHigh - yLow)

  // loop around the canvas when we reach the end
  column += 1
  if (column >= canvas.width) {
    column = 0
    clearCanvas()
  }
}

function clearCanvas () {
  column = 0
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.beginPath()
  ctx.strokeStyle = '#f00'
  var y = (canvas.height / 2) + 0.5
  ctx.moveTo(0, y)
  ctx.lineTo(canvas.width - 1, y)
  ctx.stroke()
  ctx.beginPath()
  ctx.strokeStyle = '#0f0'
  y = canvas.height / 2 * (1 - triggerThreshold) + 0.5
  ctx.moveTo(0, y)
  ctx.lineTo(canvas.width - 1, y)
  ctx.stroke()
}
