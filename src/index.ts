import { NoiseModule } from './Noise.js';

// var DB_LEVEL_RANGE = MAX_DB_LEVEL - MIN_DB_LEVEL;

let microphoneIsWiredUp = false;
// let microphoneAccessIsNotAllowed = undefined;
// let uploadMicrophoneData = false;
let suppressNoise = false;
let addNoise = false;
let mediaStream: any = null;

let Module: any = null;
function stopMicrophone() {
  if (!microphoneIsWiredUp) {
    return;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(function(track: any) {
      track.stop();
    });
  }

  microphoneIsWiredUp = false;
}

function getMicrophoneAccess(stream: any) {
  if (microphoneIsWiredUp) {
    return;
  }
  var audioContext: any;
  try {
    window.AudioContext = window.AudioContext; // || window.webkitAudioContext;
    audioContext = new AudioContext();
  } catch (e) {
    alert('Web Audio API is not supported in this browser.');
  }

  // // Check if there is microphone input.
  // navigator.getUserMedia = navigator.getUserMedia ||
  //                          navigator.webkitGetUserMedia ||
  //                          navigator.mozGetUserMedia ||
  //                          navigator.msGetUserMedia;
  // if (!navigator.getUserMedia) {
  //   alert("getUserMedia() is not supported in your browser.");
  //   return;
  // }
  var inputBuffer: any = [];
  var outputBuffer: any = [];
  var bufferSize = 512;
  //var sampleRate = audioContext.sampleRate;
  var processingNode = audioContext.createScriptProcessor(bufferSize, 1, 1);
  var noiseNode = audioContext.createScriptProcessor(bufferSize, 1, 1);

  noiseNode.onaudioprocess = function(e: any) {
    var input = e.inputBuffer.getChannelData(0);
    var output = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < input.length; i++) {
      if (addNoise) {
        output[i] = input[i] + Math.random() / 100;
      } else {
        output[i] = input[i];
      }
    }
  };

  function removeNoise(buffer: any) {
    let ptr = Module.ptr;
    let st = Module.st;
    for (let i = 0; i < 480; i++) {
      Module.HEAPF32[(ptr >> 2) + i] = buffer[i] * 32768;
    }
    Module._rnnoise_process_frame(st, ptr, ptr);
    for (let i = 0; i < 480; i++) {
      buffer[i] = Module.HEAPF32[(ptr >> 2) + i] / 32768;
    }
  }

  let frameBuffer: any = [];

  processingNode.onaudioprocess = function(e: any) {
    var input = e.inputBuffer.getChannelData(0);
    var output = e.outputBuffer.getChannelData(0);

    // Drain input buffer.
    for (let i = 0; i < bufferSize; i++) {
      inputBuffer.push(input[i]);
    }

    while (inputBuffer.length >= 480) {
      console.time('noise');
      for (let i = 0; i < 480; i++) {
        frameBuffer[i] = inputBuffer.shift();
      }
      //console.log(audioURL1,input_chunk.length,input_chunk)
      //console.log(input_chunk)
      // Process Frame

      if (suppressNoise) {
        //console.log(NoiseModule);
        removeNoise(frameBuffer);
      }

      for (let i = 0; i < 480; i++) {
        outputBuffer.push(frameBuffer[i]);
      }
      console.timeEnd('noise');
    }
    // Not enough data, exit early, etherwise the AnalyserNode returns NaNs.
    if (outputBuffer.length < bufferSize) {
      return;
    }
    // Flush output buffer.
    for (let i = 0; i < bufferSize; i++) {
      output[i] = outputBuffer.shift();
      //output_chunk.push(output[i]);
    }
  };

  // Get access to the microphone and start pumping data through the graph.

  mediaStream = stream;
  var microphone = audioContext.createMediaStreamSource(stream);
  var sourceAnalyserNode = audioContext.createAnalyser();
  var destinationAnalyserNode = audioContext.createAnalyser();
  sourceAnalyserNode.smoothingTimeConstant = 0;
  destinationAnalyserNode.smoothingTimeConstant = 0;

  sourceAnalyserNode.fftSize = 1024;
  destinationAnalyserNode.fftSize = 1024;

  microphone.connect(noiseNode);
  noiseNode.connect(sourceAnalyserNode);
  sourceAnalyserNode.connect(processingNode);
  processingNode.connect(destinationAnalyserNode);

  destinationAnalyserNode.connect(audioContext.destination);
  microphoneIsWiredUp = true;
}

// function convertFloat32ToInt16(buffer:any) {
//   let l = buffer.length;
//   let buf = new Int16Array(l);
//   while (l--) {
//     buf[l] = Math.min(1, buffer[l]) * 0x7FFF;
//   }
//   return buf;
// }

// let uploadedPackets = 0;
// function postData(arrayBuffer:any) {
//   let streamingStatus = document.getElementById("streaming_status");
//   var fd = new FormData();
//   fd.append("author", "Fake Name");
//   fd.append("attachment1", new Blob([arrayBuffer]));
//   var xhr = new XMLHttpRequest();
//   xhr.open("POST", "https://demo.xiph.org/upload");
//   xhr.onload = function (event) {
//     uploadedPackets++;
//     streamingStatus.innerText = "Donated " + uploadedPackets + " seconds of noise (of 60).";
//     if (uploadedPackets >= 60) {
//       stopStreaming();
//       stopMicrophone();
//     }
//   };
//   xhr.send(fd);
// }

function stopStreaming() {
  return;
  // let streamingButton = document.getElementById("streaming_button");
  // let streamingStatusIcon = document.getElementById("streaming_status_icon");
  // let streamingStatus = document.getElementById("streaming_status");
  // streamingStatusIcon.style.visibility = "hidden";
  // uploadMicrophoneData = false;
  // streamingButton.innerText = "Start donating a minute of noise!";
  // uploadedPackets = 0;
  // streamingStatus.innerText = "";
}

// function startStreaming() {
//   let streamingButton = document.getElementById("streaming_button");
//   let streamingStatusIcon = document.getElementById("streaming_status_icon");
//   // streamingStatusIcon.style.visibility = "visible";
//   uploadMicrophoneData = true;
//   streamingButton.innerText = "Stop donating my noise!";
// }

// function toggleStreaming() {
//   getMicrophoneAccess();
//   if (uploadMicrophoneData) {
//     stopStreaming();
//   } else {
//     startStreaming();
//   }
// }

function initializeNoiseSuppressionModule() {
  if (Module) {
    return;
  }
  Module = {
    noExitRuntime: true,
    noInitialRun: true,
    preInit: [],
    preRun: [],
    postRun: [
      function() {
        console.log(`Loaded Javascript Module OK`);
      },
    ],
    memoryInitializerPrefixURL: 'bin/',
    arguments: ['input.ivf', 'output.raw'],
  };
  //console.log('cc', NoiseModule);

  //NoiseModule(Module);
  //console.log(NoiseModule);
  Module.st = Module._rnnoise_create();
  Module.ptr = Module._malloc(480 * 4);
}

// function toggleNoise() {
//   addNoise = !addNoise;
// }

///var selectedLiveNoiseSuppression = null;
const liveNoiseSuppression = async (type: any, stream: any) => {
  //await loadfile();

  if (type == 0) {
    stopMicrophone();
    return;
  }
  getMicrophoneAccess(stream);
  initializeNoiseSuppressionModule();
  stopStreaming();
  if (type == 1) {
    suppressNoise = false;
  } else if (type == 2) {
    suppressNoise = true;
  }
};

export { liveNoiseSuppression };
