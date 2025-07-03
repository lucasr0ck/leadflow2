
import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DateRangeFilterProps {
  onDateRangeChange: (startDate: Date, endDate: Date) => void;
  defaultRange?: 'today' | 'week' | 'month' | 'all';
}

export const DateRangeFilter = ({ onDateRangeChange, defaultRange = 'week' }: DateRangeFilterProps) => {
  const [startDate, setStartDate] = useState<Date>(getDefaultStartDate(defaultRange));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isEndOpen, setIsEndOpen] = useState(false);

  function getDefaultStartDate(range: string) {
    const today = new Date();
    switch (range) {
      case 'today':
        return startOfDay(today);
      case 'week':
        return startOfDay(subDays(today, 7));
      case 'month':
        return startOfDay(subDays(today, 30));
      default:
        return startOfDay(subDays(today, 7));
    }
  }

  const handleStartDateChange = (date: Date | undefined) => {
    if (date) {
      const newStartDate = startOfDay(date);
      setStartDate(newStartDate);
      onDateRangeChange(newStartDate, endOfDay(endDate));
      setIsStartOpen(false);
    }
  };

  const handleEndDateChange = (date: Date | undefined) => {
    if (date) {
      const newEndDate = endOfDay(date);
      setEndDate(newEndDate);
      onDateRangeChange(startOfDay(startDate), newEndDate);
      setIsEndOpen(false);
    }
  };

  const handlePresetRange = (range: 'today' | 'week' | 'month' | 'all') => {
    const today = new Date();
    let newStartDate: Date;
    let newEndDate = endOfDay(today);

    switch (range) {
      case 'today':
        newStartDate = startOfDay(today);
        break;
      case 'week':
        newStartDate = startOfDay(subDays(today, 7));
        break;
      case 'month':
        newStartDate = startOfDay(subDays(today, 30));
        break;
      case 'all':
        newStartDate = startOfDay(subDays(today, 365)); // 1 ano atrás
        break;
    }

    setStartDate(newStartDate);
    setEndDate(newEndDate);
    onDateRangeChange(newStartDate, newEndDate);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2">
        <Popover open={isStartOpen} onOpenChange={setIsStartOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal",
                !startDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Data início"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={handleStartDateChange}
              disabled={(date) => date > new Date()}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        <span className="text-slate-500">até</span>

        <Popover open={isEndOpen} onOpenChange={setIsEndOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal",
                !endDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Data fim"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={handleEndDateChange}
              disabled={(date) => date > new Date() || date < startDate}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePresetRange('today')}
          className="text-xs"
        >
          Hoje
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePresetRange('week')}
          className="text-xs"
        >
          7 dias
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePresetRange('month')}
          className="text-xs"
        >
          30 dias
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePresetRange('all')}
          className="text-xs"
        >
          Tudo
        </Button>
      </div>
    </div>
  );
};
