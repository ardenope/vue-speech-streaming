<template>
  <!-- <div class="wrap">
    <div class="title">
      궁금하신 점을 물어봐 주세요
    </div>
    <div class="body">

    </div>
    <div class="footer">
      <v-btn block round color="primary" dark>
        <v-icon left>mic</v-icon>
      </v-btn>
    </div>
  </div> -->
  <v-layout row wrap>
    <v-flex xs12 class="text-xs-center">
    <v-select v-show="btn" v-bind:items="items" v-model="selected" label="Select a language"></v-select>
      <v-btn v-show="btn"  @click="startRecording" block round color="primary" dark>
        <v-icon left>mic</v-icon> Recording</v-btn>
      <v-btn v-show="btnStop" @click="stopRecording" block round color="error" dark>
        <v-icon left>stop</v-icon> 
        Stop
      </v-btn>
    </v-flex>
    <v-flex xs12>
      <vue-text-to-speech></vue-text-to-speech>
    </v-flex>
    <v-flex xs12>
      <transition name="slide">
        <div v-show="result">
  
          <v-layout row wrap>
            <v-flex xs12>
              <v-card class="blue-grey darken-2 white--text">
                   <v-card-title primary-title>
                <div class="headline"></div>
                <div>{{textResult}}</div>
              </v-card-title>

               <h6></h6> 
              </v-card>
            </v-flex>
          </v-layout>
           </div>
      </transition>
      <transition name="slide">
        <div v-show="resultError" class="text-xs-center">
          <v-layout row wrap>
            <v-flex xs12>
              <v-card class="red darken-3 white--text">
                <v-card-title primary-title>
                  <div class="headline">Reached transcription time limit</div>
                </v-card-title>
                <v-card-actions>
                  <v-btn @click.native="redirectError" flat dark>Try Again</v-btn>
                </v-card-actions>
              </v-card>
            </v-flex>            
          </v-layout>
        </div>
      </transition>
  
    </v-flex>
  </v-layout>
</template>

<script>
  import VueTextToSpeech from 'vue-text-to-speech';
  var audioContext = null;
  var socket = io.connect('http://localhost:3555');
  var ssStream = ss.createStream();
  var scriptNode;  
  export default {
    components:{
      VueTextToSpeech
    },
    data() {
      return {
        btn: true,
        btnStop: false,
        result: false,
        resultError: false,
        textResult: "",
        selected: 'ko-KR',
        streamingLimit: 14000,
        streamingTimer: null,
        items: [
          {
            text: 'English (United States)',
            value: 'en-US'
          },
          {
            text: '한국어 (대한민국)',
            value: 'ko-KR'
          }
        ]
      }
    },
    methods: {
      ensureAudioContext() {
        // due to https://goo.gl/7K7WLu we don't activate AudioContext until after a user interaction (such as clicking the record button)
        audioContext = audioContext || new(window.AudioContext || window.webkitAudioContext)();
      },
      successCallback(stream) {
        this.ensureAudioContext();
        const vm = this;
        console.log('successCallback:....IN');
        var input = audioContext.createMediaStreamSource(stream);
        var bufferSize = 2048;
        scriptNode = audioContext.createScriptProcessor(bufferSize, 1, 1);
        scriptNode.onaudioprocess = scriptNodeProcess;
        input.connect(scriptNode);
  
        // console.log('ScriptNode BufferSize:', scriptNode.bufferSize);
        function scriptNodeProcess(audioProcessingEvent) {
        var inputBuffer = audioProcessingEvent.inputBuffer;
        var outputBuffer = audioProcessingEvent.outputBuffer;
        var inputData = inputBuffer.getChannelData(0);
        var outputData = outputBuffer.getChannelData(0);
  
        // Loop through the 4096 samples
        for (var sample = 0; sample < inputBuffer.length; sample++) {
          outputData[sample] = inputData[sample];
        }
        ssStream.write(new ss.Buffer(vm.downsampleBuffer(inputData, 44100, 16000)));
      }
      },
      downsampleBuffer(buffer, sampleRate, outSampleRate) {
        if (outSampleRate == sampleRate) {
          return buffer;
        }
        if (outSampleRate > sampleRate) {
          throw "downsampling rate show be smaller than original sample rate";
        }
        var sampleRateRatio = sampleRate / outSampleRate;
        var newLength = Math.round(buffer.length / sampleRateRatio);
        var result = new Int16Array(newLength);
        var offsetResult = 0;
        var offsetBuffer = 0;
        while (offsetResult < result.length) {
          var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
          var accum = 0,
            count = 0;
          for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
          }
  
          result[offsetResult] = Math.min(1, accum / count) * 0x7FFF;
          offsetResult++;
          offsetBuffer = nextOffsetBuffer;
        }
        return result.buffer;
      },
      startRecording() {
        if(this.streamingTimer) clearInterval(this.streamingTimer);
        this.ensureAudioContext();
        const languageSelected = this.selected;
        socket.emit('LANGUAGE_SPEECH', languageSelected);
        this.result = true;
        this.btn = false;
        this.btnStop = true;
        scriptNode.connect(audioContext.destination);
        ss(socket).emit('START_SPEECH', ssStream);
        this.streamingTimer = setInterval(function() {
          this.stopRecording();
        }.bind(this), this.streamingLimit);
      },
      stopRecording() {
        if(this.streamingTimer) clearInterval(this.streamingTimer);
        this.ensureAudioContext();
        this.btnStop = false;
        this.btn = true;
        scriptNode.disconnect(audioContext.destination);
        // ssStream.end();
        socket.emit('STOP_SPEECH', {});
      },
      errorCallback(error) {
        console.log('errorCallback:', error);
      },
      redirectError(){
         window.location.href = "http://localhost:8080/"
      }
    },
    created() {
      const that = this;
     
      socket.on('SPEECH_RESULTS', function(text) {
        if('Reached_transcription_time_limit' == text){
            that.resultError = true;
        }else{
              that.textResult += text;
        }
      })
        if (navigator.mediaDevices.getUserMedia) {
          console.log('getUserMedia supported...');
          navigator.webkitGetUserMedia({ audio: true }, function(stream) {
            that.successCallback(stream)
          }, function(error) {
            that.errorCallback(error)
          });
        } else {
          console.log('getUserMedia not supported on your browser!');
        }
      }
    }
</script>


<style>
  .wrap{
    display: flex;
    flex-direction: column;
  }
  .wrap > .body {
    flex: 1;
  }
</style>
