'use strict';(function(){function g(a,b){d?self.postMessage(a,b):h.postMessage(a,b)}function l(a,b){a||console.error("workerapi: No callback was provided to onMessage!");if(b)if(d)b.onmessage=a;else b.on("message",a);else if(d)self.onmessage=a;else h.on("message",a)}function c(a,b,c){b||(b=Math.random().toString(36).replace(/[^a-z]+/g,"").substr(2,10),e++,b=`${b}-${e}`,1E5<e&&(e=0));return{workerId:c,messageId:b,message:a}}const d="undefined"!==typeof self;let h;d||(h=require("worker_threads").parentPort);
let e=0,f;const k=(a,b)=>{const d=[];Object.keys(b.message).forEach((a)=>{"type"!==a&&d.push(b.message[a])});const e=c(b.message,b.messageId);a?f.postMessage(e,d):g(e,d)},m=(a)=>{a=a.data?a.data:a;if(a.message)switch(a.message.type){case "CLEAR_MEMORY_DONE":g(c(a.message,a.messageId),[a.message.wasmByteMemory]);break;case "GET_CONSTANTS_DONE":g(c(a.message,a.messageId));break;case "SET_MEMORY_DONE":g(c(a.message,a.messageId));break;case "GET_MEMORY":k(!1,a);break;case "UPDATED":k(!1,a)}};l((a)=>{a=
a.data?a.data:a;switch(a.message.type){case "CONNECT":f=a.message.ports[0];l(m,f);g(c(void 0,a.messageId));break;case "CLEAR_MEMORY":f.postMessage(c({type:"CLEAR_MEMORY"},a.messageId));break;case "GET_CONSTANTS":f.postMessage(c({type:"GET_CONSTANTS"},a.messageId));break;case "GET_MEMORY":f.postMessage(c(a.message,a.messageId));break;case "SET_MEMORY":k(!0,a);break;default:console.log(a)}})})();
