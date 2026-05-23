// V83 compatibility loader: keeps legacy logic intact while allowing modular migration.
const script=document.createElement('script');
script.src='components/app-core.js?v=v83_shell_phase2';
document.head.appendChild(script);
