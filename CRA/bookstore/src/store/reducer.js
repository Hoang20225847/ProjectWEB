import {SET_TODO_INPUT} from './constans'
const initState={
    todos:[],
    todoInput:''
}
function reducer(state,action)
{
    switch(action.type)
    {
        case SET_TODO_INPUT:
            return {
                ...state,
                todoInput:action.payload
            }
            default: throw new Error('Invalid Error')    }
}
export {initState}
export default reducer