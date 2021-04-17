(window.webpackJsonp=window.webpackJsonp||[]).push([[18],{173:function(e,n,t){"use strict";t.r(n),n.default=t.p+"assets/images/templater_user_templates-36f6900a86474cd90e46f4ec3f836b0b.png"},90:function(e,n,t){"use strict";t.r(n),t.d(n,"frontMatter",(function(){return o})),t.d(n,"metadata",(function(){return c})),t.d(n,"toc",(function(){return s})),t.d(n,"default",(function(){return l}));var r=t(3),a=t(7),i=(t(0),t(98)),o={title:"Overview",slug:"/user-functions"},c={unversionedId:"user-functions/overview",id:"user-functions/overview",isDocsHomePage:!1,title:"Overview",description:"User functions need to be enabled in Templater's settings.",source:"@site/docs/user-functions/overview.md",slug:"/user-functions",permalink:"/Templater/docs/user-functions",editUrl:"https://github.com/SilentVoid13/Templater/docs/edit/master/docs/user-functions/overview.md",version:"current",sidebar:"docs",previous:{title:"Contributing",permalink:"/Templater/docs/internal-variables-functions/contribute"},next:{title:"Overview",permalink:"/Templater/docs/eta-features"}},s=[{value:"Define a User Function",id:"define-a-user-function",children:[]},{value:"Invoking User Functions",id:"invoking-user-functions",children:[]},{value:"User Functions Arguments",id:"user-functions-arguments",children:[]},{value:"Internal variables / functions in system commands",id:"internal-variables--functions-in-system-commands",children:[]}],u={toc:s};function l(e){var n=e.components,o=Object(a.a)(e,["components"]);return Object(i.b)("wrapper",Object(r.a)({},u,o,{components:n,mdxType:"MDXLayout"}),Object(i.b)("p",null,"User functions need to be enabled in Templater's settings."),Object(i.b)("h2",{id:"define-a-user-function"},"Define a User Function"),Object(i.b)("p",null,"To define a new user function, you need to define a ",Object(i.b)("strong",{parentName:"p"},"function name"),", associated with a ",Object(i.b)("strong",{parentName:"p"},"system command"),"."),Object(i.b)("p",null,"To do that, go to the plugin's settings and click ",Object(i.b)("inlineCode",{parentName:"p"},"Add User Function"),"."),Object(i.b)("p",null,"Once this is done, ",Object(i.b)("a",{parentName:"p",href:"https://github.com/SilentVoid13/Templater"},"Templater")," will create a user function named after what you defined, that will execute your system command and return its output."),Object(i.b)("p",null,"Just like internal functions, user functions are available under the ",Object(i.b)("inlineCode",{parentName:"p"},"tp")," JavaScript object, and more specifically under the ",Object(i.b)("inlineCode",{parentName:"p"},"tp.user")," object."),Object(i.b)("p",null,Object(i.b)("img",{alt:"user_templates",src:t(173).default})),Object(i.b)("h2",{id:"invoking-user-functions"},"Invoking User Functions"),Object(i.b)("p",null,"You can call a user function using the usual function calling syntax: ",Object(i.b)("inlineCode",{parentName:"p"},"tp.user.<user_function_name>()"),", where ",Object(i.b)("inlineCode",{parentName:"p"},"<user_function_name>")," is the name you defined in the settings. "),Object(i.b)("p",null,"For example, if you defined a user function named ",Object(i.b)("inlineCode",{parentName:"p"},"echo")," like in the above screenshot, a complete command invocation would look like: ",Object(i.b)("inlineCode",{parentName:"p"},"<% tp.user.echo() %>")),Object(i.b)("h2",{id:"user-functions-arguments"},"User Functions Arguments"),Object(i.b)("p",null,"You can pass optional arguments to user functions. They must be passed as a single JavaScript object containing properties and their corresponding values: ",Object(i.b)("inlineCode",{parentName:"p"},"{arg1: value1, arg2: value2, ...}"),"."),Object(i.b)("p",null,"These arguments will be made available for your programs / scripts in the form of ",Object(i.b)("a",{parentName:"p",href:"https://en.wikipedia.org/wiki/Environment_variable"},"environment variables"),"."),Object(i.b)("p",null,"In our previous example, this would give the following command declaration: ",Object(i.b)("inlineCode",{parentName:"p"},'<% tp.user.echo({a: "value 1", b: "value 2"})'),". "),Object(i.b)("p",null,"If our system command was calling a bash script, we would be able to access variables ",Object(i.b)("inlineCode",{parentName:"p"},"a")," and ",Object(i.b)("inlineCode",{parentName:"p"},"b")," using ",Object(i.b)("inlineCode",{parentName:"p"},"$a")," and ",Object(i.b)("inlineCode",{parentName:"p"},"$b"),"."),Object(i.b)("h2",{id:"internal-variables--functions-in-system-commands"},"Internal variables / functions in system commands"),Object(i.b)("p",null,"You can use internal variables / functions inside your system command. The internal variables / functions will be replaced by their results before your system command gets executed."),Object(i.b)("p",null,"You still need to use commands to call internal variables / functions."),Object(i.b)("p",null,"For example, if you configured the system command ",Object(i.b)("inlineCode",{parentName:"p"},"cat <% tp.file.path() %>"),", it would be replaced with ",Object(i.b)("inlineCode",{parentName:"p"},"cat /path/to/file")," before the system command gets executed."))}l.isMDXComponent=!0},98:function(e,n,t){"use strict";t.d(n,"a",(function(){return p})),t.d(n,"b",(function(){return m}));var r=t(0),a=t.n(r);function i(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function o(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);n&&(r=r.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,r)}return t}function c(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?o(Object(t),!0).forEach((function(n){i(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):o(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function s(e,n){if(null==e)return{};var t,r,a=function(e,n){if(null==e)return{};var t,r,a={},i=Object.keys(e);for(r=0;r<i.length;r++)t=i[r],n.indexOf(t)>=0||(a[t]=e[t]);return a}(e,n);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(r=0;r<i.length;r++)t=i[r],n.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(a[t]=e[t])}return a}var u=a.a.createContext({}),l=function(e){var n=a.a.useContext(u),t=n;return e&&(t="function"==typeof e?e(n):c(c({},n),e)),t},p=function(e){var n=l(e.components);return a.a.createElement(u.Provider,{value:n},e.children)},b={inlineCode:"code",wrapper:function(e){var n=e.children;return a.a.createElement(a.a.Fragment,{},n)}},d=a.a.forwardRef((function(e,n){var t=e.components,r=e.mdxType,i=e.originalType,o=e.parentName,u=s(e,["components","mdxType","originalType","parentName"]),p=l(t),d=r,m=p["".concat(o,".").concat(d)]||p[d]||b[d]||i;return t?a.a.createElement(m,c(c({ref:n},u),{},{components:t})):a.a.createElement(m,c({ref:n},u))}));function m(e,n){var t=arguments,r=n&&n.mdxType;if("string"==typeof e||r){var i=t.length,o=new Array(i);o[0]=d;var c={};for(var s in n)hasOwnProperty.call(n,s)&&(c[s]=n[s]);c.originalType=e,c.mdxType="string"==typeof e?e:r,o[1]=c;for(var u=2;u<i;u++)o[u]=t[u];return a.a.createElement.apply(null,o)}return a.a.createElement.apply(null,t)}d.displayName="MDXCreateElement"}}]);