import type { Schedule } from './types';

export function Insights({data}:{data:Schedule;now:number}) {
  return <><h1 tabIndex={-1}>Service insights</h1><p>Schedule valid {data.meta.start} to {data.meta.end}.</p></>;
}
