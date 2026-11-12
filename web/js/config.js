// The hosted site uses same-origin requests; native file-based apps use the deployed HTTPS API.
window.OK_API_BASE = window.OK_API_BASE || (location.protocol === 'file:' ? 'https://optionkiller.yuanhyu1014.workers.dev' : '');
