
//Doi tuong Validator
function  Validator(options) {
        var formElement = document.querySelector(options.form);
        var SelectorRules={};
        
        function getParent(element,selector)
        {
            while(element.parentElement)
            {
                if(element.parentElement.matches(selector))
                {
                    return element.parentElement
                }
                element=element.parentElement;
            }
        }
        if(formElement)
        {  formElement.onsubmit = function(e) {
            e.preventDefault();
            var isFormValid=true;
            options.rules.forEach(function(rule) {
                var inputElement = formElement.querySelector(rule.selector);
                 Validate(inputElement, rule);
                var isValid=Validate(inputElement,rule);
                if(!isValid)
                {
                    isFormValid=false;
                }
            }); 
            if(isFormValid)
                {    const submitElement= formElement.querySelector('button.btn');
                    if(typeof options.onSubmit === 'function'){
                        var enableInputs = formElement.querySelectorAll('[name]');
                        var formValues =Array.from(enableInputs).reduce(function(values,input)
                    {   values[input.name] = input.value;
                        return values;
                    },{});
                }       
                      
                        options.onSubmit(formValues);
                }
                else{
                   console.log('co loi')
                   
                } 
        };
            
            function Validate(inputElement,rule)
            {   
                var ErrorElement=getParent(inputElement,options.formGroupSelector).querySelector(options.errorSelector);
                var Rules=SelectorRules[rule.selector];
                var ErrorMessage;
                for(var i=0;i<Rules.length;i++)
                {
                    ErrorMessage=Rules[i](inputElement.value);
                    if(ErrorMessage)
                    {
                        break;
                    }
                }
                if(ErrorMessage)
                {
                    ErrorElement.innerText=ErrorMessage;
                    inputElement.classList.add('invalid');
                }
                else{
                    ErrorElement.innerText='';
                    inputElement.classList.remove('invalid');
                }
                return !ErrorMessage;
                

            }
            options.rules.forEach(function(rule){
                if(Array.isArray(SelectorRules[rule.selector]))
                    {
                        SelectorRules[rule.selector].push(rule.test)
                    }
                    else{
                        SelectorRules[rule.selector]=[rule.test];
                    }
                var inputElement=formElement.querySelector(rule.selector);
                if(inputElement)
                {   
                    inputElement.onblur=function(){
                        Validate(inputElement,rule);
                    }
                    inputElement.oninput=function(){
                        var ErrorElement=getParent(inputElement,options.formGroupSelector).querySelector(options.errorSelector);
                        ErrorElement.innerText='';
                        inputElement.classList.remove('invalid');
                    }
                }
            })

            }
            
}
//Dinh nghia rules
//Nguyen tac cua cac rules
//1. Khi co loi -> tra ra message loi
//2. Khi hop le -> khong tra ra cai gi ca
Validator.isRequired= function(selector){
    return{
        selector: selector,
        test: function(value){
            return value.trim() ? undefined: 'Vui long nhap truong nay'
        }
    };
}
Validator.isEmail= function(selector){
    return{
        selector: selector,
        test: function(value){
            var regex=/^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
            return regex.test(value) ? undefined : 'Truong nay phai la email';
        }
    };
}
Validator.MinLength=function(selector,min)
{
    return{
        selector:selector,
        test:function(value){
            return value.length>=min ? undefined: `Vui long nhap toi thieu ${min} ki tu`;
        }
    }
}
Validator.repeat=function(selector,getConfirmValue)
{
   return{
    selector:selector,
    test:function(value)
    {
        return value === getConfirmValue() ? undefined:'Mat khau nhap lai khong chinh xac';
    }
   }
}

Validator.validatePhoneVn = function(value) {
    var normalized = String(value || '').replace(/\s+/g, '');
    var regex = /^0\d{9}$/;
    return regex.test(normalized) ? undefined : 'So dien thoai khong hop le';
}

Validator.isPhoneVn = function(selector){
    return{
        selector: selector,
        test: function(value){
            return Validator.validatePhoneVn(value);
        }
    };
}
export default Validator;