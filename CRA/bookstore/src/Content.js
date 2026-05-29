import { useLayoutEffect,useState,useEffect,useRef,memo,useMemo,useReducer } from 'react'
//Side effects
/* 
1.useEffect(callback)
- goi callback moi khi component re-render
- goi callback sau khi component them element vao DOM
2.useEffect(Callback,[])
chi goi call back 1 lan sau khi component mounted
3.useEffect(Callback,[deps]) 
--Callback luon duoc hoi sau khi component Mounted
-------------
1. Callback luon duoc goi sau khi compoment mounted
//setTimeout chi cchay 1 lan
//set Interval chạy như while
--------
1.Cleanup function luon duoc goi truoc khi component unmounted
2.Cleanup function luon duoc goi truoc khi call back duoc goi(tru lan Mounted)
-------
UseEffect
1.cap nhat lai state
2.cap nhat DOM
3.render lai UI
4.Goi cleanup neu deps thay doi
5.Goi useEffect call back
useLayout Effect
1.Cap nhat lai state
2.cap nhat DOM
3.Goi cleanup neu deps thay doi
4.Goi useLayoutEffect callback
5.Render lai UI
----

1.memo()-> Higher Order Component (HOC) check xem props co thay doi ko neu thay doi thi render lai
useReducer
1.Init State:
2.Action up (state+1)/ down (state-1)
3.Reducer
4.dispatch
-----
use context
1.Create context
2.Provider
3.Consumer
*/
 const initState={
    job:'',
    jobs:[]
}
//Action
const SET_Job='SetJob'
const ADD_Job='AddJob'
const DELETE_job='DeleteJob'

const reducer = (state,action) => {
    switch(action.type)
    {
        case SET_Job:
            console.log("1")
            return {
                
                ...state,
                job:action.payload
        }
        case ADD_Job:


             return {
                ...state,
                jobs:[...state.jobs,action.payload]
        }
        case DELETE_job:
            const newjobs=[...state.jobs]
                newjobs.splice(action.payload,1)
            return{
                ...state,
                jobs:newjobs
        }
        default:throw new Error('In validation')
        
    }
}
const tabs=['posts','comments','albums']
function Content(){
    const[state,dispatch]=useReducer(reducer,initState)
    const {job,jobs}=state
    const[countDown,setcountDown]=useState('180')
    const[posts,setPosts]=useState([])
    const[title,setTitle]=useState('')
    const[type,setType]=useState('posts')
    const[showGoToTop,setshowGoToTop]=useState(false)
    useEffect(()=>{
        fetch('https://jsonplaceholder.typicode.com/'+type)
        .then(res=>res.json())
        .then(posts=>{
            setPosts(posts);
        })
    },[type])
    //useEffect(callback,[deps])
   useEffect(() =>{
    const handleScroll=()=>{
        if(window.scrollY >=200)
        {
            setshowGoToTop(true)
        }
        else{
            setshowGoToTop(false)
        }
    }
    window.addEventListener('scroll',handleScroll)
    return() =>{
        window.removeEventListener('scroll',handleScroll)
    } 
    },[])
    const[avatar,setAvartar]=useState()
    useEffect(()=>{
        //cleanup
        return () =>{
           avatar && URL.revokeObjectURL(avatar.preview)
        }
    },[avatar])
    
//    useEffect(()=>{
//     const timerId=setInterval(()=>{
//         setcountDown(prevState =>prevState-1)
//     },1000)
//    return()=>clearInterval(timerId)
//     },[])
    const handlePreviewAvatar=(e)=>{
        const file=e.target.files[0]
        file.preview=URL.createObjectURL(file)
        setAvartar(file)
    }
    let timeId=useRef()
    const[count,setCount]=useState('60')
    const handleStart=()=>{
        timeId.current=setInterval(()=>{
           setCount(prevCount => prevCount-1) 
        },1000)
        }
   const handleStop = () =>
    {
        clearInterval(timeId.current)
    }
    const [fullName,setfullName]=useState('')
    const [price,setPrice]=useState('')
    const[listProduct,setListProduct]=useState([])
    const handleSubmit= () =>{
        setListProduct([...listProduct,{
            fullName,
            price: +price
        }])
        setfullName('')
        setPrice('')
    }
    const total= useMemo(()=>{
        
        const result =listProduct.reduce((result,prod) => result + prod.price,0 )

        return result
    },[listProduct]) 
    const[number,setNumber]=useState(0)
    const setJob=(payload)=>{
         return {
            type:SET_Job,
            payload:payload
    }}
    const addJob=(payload) =>{
        return {
            type:ADD_Job,
            payload:payload
        }
    }
    const removeJob=(payload) =>{
        return {
            type:DELETE_job,
            payload:payload
        }
    }
    const handleClick=() =>
    {
        dispatch(addJob(job))
    }
    const handleTime=(index) =>{
        dispatch(removeJob(index))
    }
    return(
        <div>
            {tabs.map(tab =>(
                <button key={tab}
                        onClick={() => setType(tab)}>
                    {tab}
                </button>
            ))}
            <input
            value={title}
            onChange={e=>setTitle(e.target.value)}
            />
            {/* <ul>
                {
                    posts.map(post=>(
                        <li key={post.id}>{post.title}</li>
                    ))
                }
                {showGoToTop && (
                    <button
                    stype={{
                        position:'fixed',
                        right:20,
                        bottom:20,
                    }}>Go to Top</button>
                )}
            </ul> */}
            <h1>{countDown}</h1>
            <input
            type='file'
            onChange={handlePreviewAvatar}
            />
            {avatar && (
                <img src={avatar.preview} alt="" width="80%"/>
            )}
            <h1>{count}</h1>
            <button onClick={handleStart}>start</button>
            <button onClick={handleStop}>Stop</button>
            <input
                value={fullName}
                placeholder="Enter Name..."
                onChange={e => setfullName(e.target.value)}
            />
            <input
                value={price}
                placeholder="Enter Price..."
                onChange={e => setPrice(e.target.value)}
            />
            <button onClick={handleSubmit}
            >add</button>
            Total:{total}
            <ul>
                {
                    listProduct.map((product,index) => (
                        <li key={index}>{product.fullName} - {product.price}</li>
                    ))
                }
            </ul>
            <h1>{number}</h1>
            <button onClick={() => setNumber(number-1)}>Down</button>
            <button onClick={() => setNumber(number+1)}>up</button>
            <h1>Todo</h1>
            <input
                value={job}
             placeholder='Enter todo'
             onChange={e =>{
                dispatch(setJob(e.target.value))
             }}   
            />
            <button onClick={handleClick}>Add</button>
            <ul>
                {
                    jobs.map((job,index) => (
                       
                        <li key={index}>{job}
                        
                        <span onClick={() => handleTime(index)} >&times;</span>
                        </li>
                       
                    )
               )
                }
            </ul>
        </div>
    )
}
export default Content