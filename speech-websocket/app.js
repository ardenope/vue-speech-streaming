
const io = require('socket.io')(3555);
const ss = require('socket.io-stream');
console.log('Server is starting....DONE');
io.on('connection', function (socket) {
    const record = require('node-record-lpcm16');
    const Speech = require('@google-cloud/speech');

// Instantiates a client
   const speech = Speech({
        keyFilename: './speech-to-text-key.json' // file json key
   });
    const encoding = 'LINEAR16';
    const sampleRateHertz = 16000;

    var request = {
        config: {
            encoding: encoding,
            sampleRateHertz: sampleRateHertz,
            languageCode: null
        },
        interimResults: false // If you want interim results, set this to true
    };

// Create a recognize stream
    const recognizeStream = speech.streamingRecognize(request)
        .on('error', function(error){
            console.log('ERROR:',error);
        })
        .on('data', function(data){
            console.log('GoogleData:',data);
            socket.emit('SPEECH_RESULTS',(data.results[0] && data.results[0].alternatives[0])
                ? `${data.results[0].alternatives[0].transcript}\n`
                : `Reached_transcription_time_limit`)
        }).on("end", () => {
            //this gets called every second. 
            console.log("Rec END")
        });


    console.log('SERVER CONNECT');
    ss(socket).on('START_SPEECH', function (stream) {
        console.log('START_SPEECH');
        stream.pipe(recognizeStream);
    });
    socket.on('LANGUAGE_SPEECH', function (language) {
        console.log('set language');
        request.config.languageCode = language;
    }).on('STOP_SPEECH', function () {
        console.log('STOP_SPEECH');
        speech.streamingRecognize(null);
    })
});

