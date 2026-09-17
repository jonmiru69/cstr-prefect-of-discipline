import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/latin-600.css';
import './fonts.css';
import './styles.css';
import App from './App';

class ErrorBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 render(){if(this.state.failed)return <main className="fatal"><h1>The portal could not open this screen.</h1><p>Reload the page. If the issue continues, contact the system administrator.</p><button onClick={()=>location.reload()}>Reload</button></main>;return this.props.children}
}
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App/></ErrorBoundary>);
