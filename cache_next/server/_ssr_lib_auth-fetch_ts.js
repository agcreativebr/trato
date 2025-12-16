"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "_ssr_lib_auth-fetch_ts";
exports.ids = ["_ssr_lib_auth-fetch_ts"];
exports.modules = {

/***/ "(ssr)/./lib/auth-fetch.ts":
/*!***************************!*\
  !*** ./lib/auth-fetch.ts ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   authFetch: () => (/* binding */ authFetch)\n/* harmony export */ });\n/* harmony import */ var _supabase_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./supabase-client */ \"(ssr)/./lib/supabase-client.ts\");\n\nasync function authFetch(input, init) {\n    const supabase = (0,_supabase_client__WEBPACK_IMPORTED_MODULE_0__.getSupabaseBrowserClient)();\n    const { data } = await supabase.auth.getSession();\n    const headers = new Headers(init?.headers || {});\n    const token = data?.session?.access_token;\n    if (token) {\n        headers.set(\"Authorization\", `Bearer ${token}`);\n    }\n    return fetch(input, {\n        ...init,\n        headers\n    });\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9saWIvYXV0aC1mZXRjaC50cyIsIm1hcHBpbmdzIjoiOzs7OztBQUE2RDtBQUV0RCxlQUFlQyxVQUFVQyxLQUF3QixFQUFFQyxJQUFrQjtJQUMzRSxNQUFNQyxXQUFXSiwwRUFBd0JBO0lBQ3pDLE1BQU0sRUFBRUssSUFBSSxFQUFFLEdBQUcsTUFBTUQsU0FBU0UsSUFBSSxDQUFDQyxVQUFVO0lBQy9DLE1BQU1DLFVBQVUsSUFBSUMsUUFBUU4sTUFBTUssV0FBVyxDQUFDO0lBQzlDLE1BQU1FLFFBQTRCTCxNQUFNTSxTQUFTQztJQUNqRCxJQUFJRixPQUFPO1FBQ1ZGLFFBQVFLLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLEVBQUVILE1BQU0sQ0FBQztJQUMvQztJQUNBLE9BQU9JLE1BQU1aLE9BQU87UUFBRSxHQUFHQyxJQUFJO1FBQUVLO0lBQVE7QUFDeEMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9rYW5iYW5wcm8vLi9saWIvYXV0aC1mZXRjaC50cz9mNzk2Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGdldFN1cGFiYXNlQnJvd3NlckNsaWVudCB9IGZyb20gXCIuL3N1cGFiYXNlLWNsaWVudFwiO1xyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGF1dGhGZXRjaChpbnB1dDogUmVxdWVzdEluZm8gfCBVUkwsIGluaXQ/OiBSZXF1ZXN0SW5pdCkge1xyXG5cdGNvbnN0IHN1cGFiYXNlID0gZ2V0U3VwYWJhc2VCcm93c2VyQ2xpZW50KCkgYXMgYW55O1xyXG5cdGNvbnN0IHsgZGF0YSB9ID0gYXdhaXQgc3VwYWJhc2UuYXV0aC5nZXRTZXNzaW9uKCk7XHJcblx0Y29uc3QgaGVhZGVycyA9IG5ldyBIZWFkZXJzKGluaXQ/LmhlYWRlcnMgfHwge30pO1xyXG5cdGNvbnN0IHRva2VuOiBzdHJpbmcgfCB1bmRlZmluZWQgPSBkYXRhPy5zZXNzaW9uPy5hY2Nlc3NfdG9rZW47XHJcblx0aWYgKHRva2VuKSB7XHJcblx0XHRoZWFkZXJzLnNldChcIkF1dGhvcml6YXRpb25cIiwgYEJlYXJlciAke3Rva2VufWApO1xyXG5cdH1cclxuXHRyZXR1cm4gZmV0Y2goaW5wdXQsIHsgLi4uaW5pdCwgaGVhZGVycyB9KTtcclxufVxyXG5cclxuXHJcbiJdLCJuYW1lcyI6WyJnZXRTdXBhYmFzZUJyb3dzZXJDbGllbnQiLCJhdXRoRmV0Y2giLCJpbnB1dCIsImluaXQiLCJzdXBhYmFzZSIsImRhdGEiLCJhdXRoIiwiZ2V0U2Vzc2lvbiIsImhlYWRlcnMiLCJIZWFkZXJzIiwidG9rZW4iLCJzZXNzaW9uIiwiYWNjZXNzX3Rva2VuIiwic2V0IiwiZmV0Y2giXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./lib/auth-fetch.ts\n");

/***/ })

};
;