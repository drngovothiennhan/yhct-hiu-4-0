import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

type Props={children:React.ReactNode};
type State={failed:boolean;message:string};

export default class AppErrorBoundary extends React.Component<Props,State>{
  state:State={failed:false,message:''};

  static getDerivedStateFromError(error:unknown):State{
    return {failed:true,message:error instanceof Error?error.message:'Lỗi giao diện không xác định'};
  }

  componentDidCatch(error:unknown,info:React.ErrorInfo){
    console.error('[YHCT ErrorBoundary]',error,info.componentStack);
  }

  private recover=()=>{
    this.setState({failed:false,message:''});
    window.location.assign('/');
  };

  render(){
    if(!this.state.failed)return this.props.children;
    return <main className="fatal-boundary" role="alert">
      <section className="panel fatal-boundary-card">
        <AlertTriangle aria-hidden="true"/>
        <h1>Ứng dụng đã tự cô lập một lỗi giao diện</h1>
        <p>Không có “màn hình trắng”. Bạn có thể tải lại vùng ứng dụng an toàn; dữ liệu máy chủ không bị thay đổi bởi thao tác này.</p>
        {this.state.message&&<pre>{this.state.message}</pre>}
        <button type="button" onClick={this.recover}><RefreshCw/>Khôi phục giao diện</button>
      </section>
    </main>;
  }
}
