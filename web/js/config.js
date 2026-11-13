// The hosted site uses same-origin requests; native file-based apps use the deployed HTTPS API.
window.OK_API_BASE = window.OK_API_BASE || (location.protocol === 'file:' ? 'https://optionkiller.pages.dev' : '');

// Bound the complete API response, including body reads, so offline native screens never spin indefinitely.
window.OK_FETCH = function(url, options, timeoutMs) {
  var controller=new AbortController(), timer;
  var timeout=new Promise(function(_,reject){timer=setTimeout(function(){controller.abort();reject(new Error('连接超时，请检查网络后重试'));},timeoutMs || 15000);});
  var request=fetch(url,Object.assign({},options,{signal:controller.signal})).then(function(response){
    return response.arrayBuffer().then(function(body){return new Response([204,205,304].includes(response.status)?null:body,{status:response.status,statusText:response.statusText,headers:response.headers});});
  });
  return Promise.race([request,timeout]).catch(function(e){if(e.name==='AbortError')throw new Error('连接超时，请检查网络后重试');if(e instanceof TypeError)throw new Error('网络连接失败，请检查服务地址和网络后重试');throw e;}).finally(function(){clearTimeout(timer);});
};
