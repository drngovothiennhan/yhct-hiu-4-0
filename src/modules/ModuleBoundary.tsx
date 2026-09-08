import {Component,type ErrorInfo,type ReactNode} from 'react';
import type {ModuleId} from './moduleContract';

class Boundary extends Component<{moduleId:ModuleId;children:ReactNode},{error:string}> {
  state={error:''};
  static getDerivedStateFromError(error:Error){return{error:error?.message||'Lỗi module không xác định'}}
  componentDidCatch(error:Error,info:ErrorInfo){
    console.error(JSON.stringify({event:'module_boundary_error',module:this.props.moduleId,message:error?.message||String(error),stack:info.componentStack?.slice(0,1600)||''}));
  }
  componentDidUpdate(prev:{moduleId:ModuleId}){if(prev.moduleId!==this.props.moduleId&&this.state.error)this.setState({error:''})}
  render(){
    if(this.state.error)return <section className="module-failure" role="alert" data-module={this.props.moduleId}><h2>Module tạm thời gặp lỗi</h2><p>{this.state.error}</p><button onClick={()=>this.setState({error:''})}>Thử tải lại module</button></section>;
    return <section className="module-boundary" data-module={this.props.moduleId} data-module-isolated="true">{this.props.children}</section>;
  }
}

export default Boundary;
