"use client";

import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface CalendarSchedulerProps {
  timeSlots?: string[];
  onConfirm?: (value: { date?: Date; time?: string }) => void;
  defaultDate?: Date;
  defaultTime?: string;
  className?: string;
}

function CalendarScheduler({
  timeSlots = [
    "08:00 AM",
    "09:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "01:00 PM",
    "02:00 PM",
    "03:00 PM",
    "04:00 PM",
    "05:00 PM",
  ],
  onConfirm,
  defaultDate,
  defaultTime,
  className,
}: CalendarSchedulerProps) {
  const [date, setDate] = React.useState<Date | undefined>(defaultDate);
  const [time, setTime] = React.useState<string | undefined>(defaultTime);

  return (
    <Card className={cn("w-full shadow-sm border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">Select Date & Time</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row gap-6">
        {/* Calendar Section */}
        <div className="flex-1 border border-gray-100 dark:border-slate-800 rounded-xl p-2 bg-gray-50/50 dark:bg-slate-950/50">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-md w-full"
            disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
          />
        </div>

        {/* Time Slots Section */}
        <div className="flex-1 border border-gray-100 dark:border-slate-800 rounded-xl p-3 bg-gray-50/50 dark:bg-slate-950/50 overflow-y-auto max-h-[320px] custom-scrollbar">
          <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
            Available Slots
          </p>
          <div className="grid grid-cols-2 gap-2">
            {timeSlots.map((slot) => (
              <Button
                key={slot}
                variant={time === slot ? "default" : "outline"}
                size="sm"
                className={cn(
                  "w-full h-10 transition-all font-medium", 
                  time === slot 
                    ? "bg-brand-blue hover:bg-brand-blue-dark text-white ring-2 ring-brand-blue/30 ring-offset-1" 
                    : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-brand-blue"
                )}
                onClick={(e) => {
                  e.preventDefault();
                  setTime(slot);
                }}
              >
                {slot}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-3 pt-2">
        <Button
          variant="outline"
          size="sm"
          className="border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 h-9"
          onClick={(e) => {
            e.preventDefault();
            setDate(undefined);
            setTime(undefined);
          }}
        >
          Reset
        </Button>
        <Button
          size="sm"
          className="bg-brand-blue hover:bg-brand-blue-dark text-white font-medium h-9 px-6"
          onClick={(e) => {
            e.preventDefault();
            onConfirm?.({ date, time });
          }}
          disabled={!date || !time}
        >
          Confirm
        </Button>
      </CardFooter>
    </Card>
  );
}

export { CalendarScheduler };
