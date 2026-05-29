import video1 from'./videos/download.mp4'
import { forwardRef } from 'react'
import { useImperativeHandle,useRef } from 'react'
function Video(props,ref) {
    const videoRef=useRef()
    useImperativeHandle(ref,() => ({
        play()
        { 
            videoRef.current.play()

        },
        pause() {
             videoRef.current.pause()
        }
    }) )
    return (
        <video
        ref={videoRef}
         width={280}
        src={video1}/>
    )
}
export default forwardRef(Video)