const nameMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export const toShortDateFormat = (timestamp: number): string => {
  const date = new Date(timestamp * 1000) 
  const shortYear = date.getFullYear().toString() // .slice(2,4) 

  return `${nameMonths[date.getMonth()]} ${shortYear}`
}; 

export const toFullDateFormat = (timestamp: number): string => {
  const date = new Date(timestamp * 1000) 
  return `${date.getDate()} ${nameMonths[date.getMonth()]} ${date.getFullYear()}`
}; 

export const toFullDateAndTimeFormat = (timestamp: number): string => {
  const date = new Date(timestamp * 1000) 
  let minutes = date.getMinutes().toString()
  if (minutes.length == 1) minutes = `0${minutes}`
  return `${date.getDate()} ${nameMonths[date.getMonth()]} ${date.getFullYear()}: ${date.getHours()}:${minutes}`
}; 


export const toEurTimeFormat = (timestamp: number): string => {
  const date = new Date(timestamp * 1000) 
  let minutes = date.getMinutes().toString()
  if (minutes.length == 1) minutes = `0${minutes}`
  return `${date.getHours()}:${minutes}`
}; 

export const toTimestamp = (dateFormat: string): string => { 
  return String(Date.parse(dateFormat))
};

export const blocksToHoursAndMinutes = (timestamp: number): string | undefined => { 
  const timeStampNow = Math.floor(Date.now() / 1000)
  const minutes = (timestamp - timeStampNow) / 60 

  const response = minutes < 60 ? ` ${Math.floor(minutes)} minutes.` 
  : ` ${Math.floor(minutes / 60)} hours and ${Math.floor(minutes % 60)} minutes.`

  return response 
};

export const blocksToApproxDuration = (blocks: bigint, blocksPerHour: number): string => {
  const totalMinutes = Math.round((Number(blocks) / blocksPerHour) * 60)
  if (totalMinutes < 1) return '<1m'
  if (totalMinutes < 60) return `appr. ${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours < 24) return minutes > 0 ? `appr. ${hours}h ${minutes}m` : `appr. ${hours}h`
  const days = Math.floor(hours / 24)
  const remainHours = hours % 24
  return remainHours > 0 ? `appr. ${days}d ${remainHours}h` : `appr. ${days}d`
}

export const toDDMMYYYY = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
};
