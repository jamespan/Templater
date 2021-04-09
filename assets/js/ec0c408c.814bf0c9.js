(window.webpackJsonp=window.webpackJsonp||[]).push([[21],{92:function(e,n,t){"use strict";t.r(n),t.d(n,"frontMatter",(function(){return i})),t.d(n,"metadata",(function(){return c})),t.d(n,"toc",(function(){return s})),t.d(n,"default",(function(){return m}));var r=t(3),a=t(7),o=(t(0),t(95)),i={title:"Overview"},c={unversionedId:"user-commands/overview",id:"user-commands/overview",isDocsHomePage:!1,title:"Overview",description:"New user command",source:"@site/docs/user-commands/overview.md",slug:"/user-commands/overview",permalink:"/Templater/docs/user-commands/overview",editUrl:"https://github.com/SilentVoid13/Templater/docs/edit/master/docs/user-commands/overview.md",version:"current"},s=[{value:"New user command",id:"new-user-command",children:[]},{value:"Using User Commands",id:"using-user-commands",children:[]},{value:"User Functions Arguments",id:"user-functions-arguments",children:[]},{value:"Internal commands in system commands",id:"internal-commands-in-system-commands",children:[]}],u={toc:s};function m(e){var n=e.components,t=Object(a.a)(e,["components"]);return Object(o.b)("wrapper",Object(r.a)({},u,t,{components:n,mdxType:"MDXLayout"}),Object(o.b)("h2",{id:"new-user-command"},"New user command"),Object(o.b)("p",null,"To define a new user command, you need to define a ",Object(o.b)("strong",{parentName:"p"},"function name"),", associated with a ",Object(o.b)("strong",{parentName:"p"},"system command"),". "),Object(o.b)("p",null,"To do that, go to the plugin's settings and click ",Object(o.b)("inlineCode",{parentName:"p"},"Add User Command"),"."),Object(o.b)("p",null,"Once this is done, ",Object(o.b)("a",{parentName:"p",href:"https://github.com/SilentVoid13/Templater"},"Templater")," will create a user function named after what you defined, that will execute your system command and return its output."),Object(o.b)("p",null,"Just like internal functions, user functions are available under the ",Object(o.b)("inlineCode",{parentName:"p"},"tp")," JavaScript object, and more specifically under the ",Object(o.b)("inlineCode",{parentName:"p"},"tp.user")," object."),Object(o.b)("p",null,Object(o.b)("img",{parentName:"p",src:"https://raw.githubusercontent.com/SilentVoid13/Templater/master/imgs/templater_user_templates.png",alt:"user_templates"})),Object(o.b)("h2",{id:"using-user-commands"},"Using User Commands"),Object(o.b)("p",null,"You can call a user function using the usual function calling syntax: ",Object(o.b)("inlineCode",{parentName:"p"},"tp.user.<user_function_name>()"),", where ",Object(o.b)("inlineCode",{parentName:"p"},"<user_function_name>")," is the name you defined in the settings. "),Object(o.b)("p",null,"For example, if you defined a user function named ",Object(o.b)("inlineCode",{parentName:"p"},"echo")," like in the above screenshot, a complete user command invocation would look like: ",Object(o.b)("inlineCode",{parentName:"p"},"<% tp.user.echo() %>")),Object(o.b)("h2",{id:"user-functions-arguments"},"User Functions Arguments"),Object(o.b)("p",null,"You can pass optional arguments to user functions. They must be passed as a single JavaScript object containing properties and their corresponding values: ",Object(o.b)("inlineCode",{parentName:"p"},"{arg1: value1, arg2: value2, ...}"),"."),Object(o.b)("p",null,"These arguments will be made available for your programs / scripts in the form of ",Object(o.b)("a",{parentName:"p",href:"https://en.wikipedia.org/wiki/Environment_variable"},"environment variables"),"."),Object(o.b)("p",null,"In our previous example, this would give the following user command declaration: ",Object(o.b)("inlineCode",{parentName:"p"},'<% tp.user.echo({a: "value 1", b: "value 2"})'),". "),Object(o.b)("p",null,"If our system command was calling a bash script, we would be able to access variables ",Object(o.b)("inlineCode",{parentName:"p"},"a")," and ",Object(o.b)("inlineCode",{parentName:"p"},"b")," using ",Object(o.b)("inlineCode",{parentName:"p"},"$a")," and ",Object(o.b)("inlineCode",{parentName:"p"},"$b"),"."),Object(o.b)("h2",{id:"internal-commands-in-system-commands"},"Internal commands in system commands"),Object(o.b)("p",null,"You can use internal commands inside your system command. The internal commands will be replaced with their results before your system command gets executed."),Object(o.b)("p",null,"For example, if you configured the system command ",Object(o.b)("inlineCode",{parentName:"p"},"cat <% tp.file.path() %>"),", it would be replaced with ",Object(o.b)("inlineCode",{parentName:"p"},"cat /path/to/file")," before the system command gets executed."))}m.isMDXComponent=!0},95:function(e,n,t){"use strict";t.d(n,"a",(function(){return l})),t.d(n,"b",(function(){return b}));var r=t(0),a=t.n(r);function o(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function i(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);n&&(r=r.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,r)}return t}function c(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?i(Object(t),!0).forEach((function(n){o(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):i(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function s(e,n){if(null==e)return{};var t,r,a=function(e,n){if(null==e)return{};var t,r,a={},o=Object.keys(e);for(r=0;r<o.length;r++)t=o[r],n.indexOf(t)>=0||(a[t]=e[t]);return a}(e,n);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(r=0;r<o.length;r++)t=o[r],n.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(a[t]=e[t])}return a}var u=a.a.createContext({}),m=function(e){var n=a.a.useContext(u),t=n;return e&&(t="function"==typeof e?e(n):c(c({},n),e)),t},l=function(e){var n=m(e.components);return a.a.createElement(u.Provider,{value:n},e.children)},p={inlineCode:"code",wrapper:function(e){var n=e.children;return a.a.createElement(a.a.Fragment,{},n)}},d=a.a.forwardRef((function(e,n){var t=e.components,r=e.mdxType,o=e.originalType,i=e.parentName,u=s(e,["components","mdxType","originalType","parentName"]),l=m(t),d=r,b=l["".concat(i,".").concat(d)]||l[d]||p[d]||o;return t?a.a.createElement(b,c(c({ref:n},u),{},{components:t})):a.a.createElement(b,c({ref:n},u))}));function b(e,n){var t=arguments,r=n&&n.mdxType;if("string"==typeof e||r){var o=t.length,i=new Array(o);i[0]=d;var c={};for(var s in n)hasOwnProperty.call(n,s)&&(c[s]=n[s]);c.originalType=e,c.mdxType="string"==typeof e?e:r,i[1]=c;for(var u=2;u<o;u++)i[u]=t[u];return a.a.createElement.apply(null,i)}return a.a.createElement.apply(null,t)}d.displayName="MDXCreateElement"}}]);