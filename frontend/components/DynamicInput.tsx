"use client";

import React, { ChangeEvent, useEffect, useState } from "react";
import { parseInput } from "@/utils/parsers";
import { DataType, InputType } from "@/context/types";
import { 
 MinusIcon,
 PlusIcon
} from '@heroicons/react/24/outline';
import { setAction, useActionStore } from "@/context/store";
import { setError } from "@/context/store";

type InputProps = {
  dataType: DataType;
  varName: string;
  values: InputType | InputType[]
  onChange: (input: InputType | InputType[]) => void;
  index: number;
}

export function DynamicInput({dataType, varName, values, onChange, index}: InputProps) {
  const [inputArray, setInputArray] = useState<InputType[]>(values instanceof Array ? values : [values ?? ""])
  const [itemsArray, setItemsArray] = useState<number[]>([0])
  const action = useActionStore()

  // Sync local state with global action store
  useEffect(() => {
    if (action.paramValues && action.paramValues.length > 0) {
      const newValues = values instanceof Array ? values : [values ?? ""]
      setInputArray(newValues)
      setItemsArray([...Array(newValues.length).keys()])
    }
  }, [action.paramValues, values])

  // console.log("@dynamicInput: ", {error, inputArray, dataType, varName, values, itemsArray, inputValue})

  const inputType = 
    dataType.indexOf('int') > -1 ? "number"
    : dataType.indexOf('bool') > -1 ? "boolean"
    : dataType.indexOf('string') > -1 ? "string"
    : dataType.indexOf('address') > -1 ? "string"
    : dataType.indexOf('bytes') > -1 ? "string"
    : dataType.indexOf('empty') > -1 ? "empty"
    : "unsupported"
  
  const array = 
    dataType.indexOf('[]') > -1 ? true : false

  const handleChange=({event, item}: {event:ChangeEvent<HTMLInputElement>, item: number}) => {
    const currentInput = parseInput(event, dataType)
    if (currentInput == 'Incorrect input data') {
      setError({error: currentInput}) 
    } else if(typeof onChange === 'function') {
      setError({error: "no error"})
      const currentArray = [...inputArray] // Create a copy to avoid mutating state
      if (array) {  
        currentArray[item] = currentInput
        setInputArray(currentArray)
        onChange(currentArray)
      } else {
        currentArray[0] = currentInput
        setInputArray(currentArray)
        onChange(currentArray[0])
      }
      // Update global action store with new param values
      const newParamValues = [...(action.paramValues || [])]
      newParamValues[index] = array ? currentArray : currentArray[0]
      setAction({...action, paramValues: newParamValues, upToDate: false})   
    }    
  }

  const handleResizeArray = (event: React.MouseEvent<HTMLButtonElement>, expand: boolean, arrayIndex?: number) => {
    if (arrayIndex === undefined) {
      arrayIndex = itemsArray.length - 1
    }
    event.preventDefault() 

    if (expand) {
      const newItemsArray = [...Array(itemsArray.length + 1).keys()]
      const newInputArray = [...inputArray, ""]
      setItemsArray(newItemsArray) 
      setInputArray(newInputArray)
      // Update global action store
      const newParamValues = [...(action.paramValues || [])]
      newParamValues[index] = newInputArray
      setAction({...action, paramValues: newParamValues, upToDate: false})
    } else {
      const newItemsArray = [...Array(itemsArray.length - 1).keys()]
      const newInputArray = inputArray.slice(0, arrayIndex)
      setItemsArray(newItemsArray) 
      setInputArray(newInputArray)
      // Update global action store
      const newParamValues = [...(action.paramValues || [])]
      newParamValues[index] = newInputArray
      setAction({...action, paramValues: newParamValues, upToDate: false})
    }
  }

  return (
    <div className="w-full flex flex-col">
      {itemsArray.map((item, i) => {
        // console.log("@inputArray", {inputArray, item, test: inputArray[item], values, index})  
        return (
          <div className={`w-full flex items-center gap-2 ${i > 0 ? 'mt-2' : ''}`} key={i}>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider min-w-24">
              {`${varName.length > 16 ? `${varName.slice(0, 16)}..` : varName}`}
            </label>

            {
            inputType == "string" ? 
                <input 
                  type="text" 
                  name={`input${item}`} 
                  id={`input${item}`}
                  value={typeof inputArray[item] != "boolean" && inputArray[item] ? String(inputArray[item]) : ""}
                  className="flex-1 bg-background border border-border  px-3 py-2 text-xs focus:outline-none focus:border-foreground/50 transition-colors font-mono"
                  placeholder={`Enter ${dataType.replace(/[\[\]']+/g, '')} here.`}
                  onChange={(event) => handleChange({event, item})}
                />
            : 
            inputType == "number" ? 
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name={`input${item}`} 
                  id={`input${item}`}
                  value={inputArray[item] ? inputArray[item].toString() : "0"}
                  className="flex-1 bg-background border border-border  px-3 py-2 text-xs focus:outline-none focus:border-foreground/50 transition-colors font-mono"
                  placeholder={`Enter ${dataType.replace(/[\[\]']+/g, '')} value here.`}
                  onChange={(event) => handleChange({event, item})}
                />
            :
            inputType == "boolean" ? 
                <div className="flex-1 bg-background border border-border  px-3 py-2 flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    name={`input${item}`} 
                    id={`input${item}`}
                    value={inputArray[item] === true ? "false" : "true"} 
                    checked={inputArray[item] === true}
                    className="h-4 w-4  border-border text-foreground focus:ring-foreground/50" 
                    onChange={(event) => handleChange({event, item})}
                  />
                  <span className="text-xs font-mono text-foreground">
                    {inputArray[item] === true ? "true" : "false"}
                  </span>
                </div>
            :
            <div className="flex-1 bg-background border border-destructive  px-3 py-2 text-xs text-destructive">  
              error: data not recognised.
            </div>  
            }
            {
              array && item == itemsArray.length - 1 ?
                <div className="flex gap-2">
                  <button 
                    type="button"
                    className="h-9 w-9 flex items-center justify-center  bg-background border border-border hover:bg-muted transition-colors"
                    onClick={(event) => handleResizeArray(event, true)}
                  > 
                    <PlusIcon className="h-4 w-4"/> 
                  </button>
                  {
                  item > 0 ? 
                    <button 
                      type="button"
                      className="h-9 w-9 flex items-center justify-center  bg-background border border-border hover:bg-muted transition-colors"
                      onClick={(event) => handleResizeArray(event, false, item)}
                    > 
                      <MinusIcon className="h-4 w-4"/> 
                    </button>
                  : null 
                  }
                </div>
              :
              null
            } 

          </div>
        )
      })}
    </div>
  )
}