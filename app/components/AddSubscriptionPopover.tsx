import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { zodResolver } from '@hookform/resolvers/zod'
import { PlusCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import type { Subscription } from '~/store/subscriptionStore'
import { IconUrlInput } from './IconFinder'

interface AddSubscriptionPopoverProps {
  addSubscription: (subscription: Omit<Subscription, 'id'>) => void
  rates: Record<string, number> | null
}

const subscriptionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  price: z.number().min(0.01, 'Price must be greater than 0'),
  currency: z.string().min(1, 'Currency is required'),
  icon: z.string().optional(),
  domain: z.string().url('Invalid URL'),
})

type SubscriptionFormValues = z.infer<typeof subscriptionSchema>

export const AddSubscriptionPopover: React.FC<AddSubscriptionPopoverProps> = ({ addSubscription, rates }) => {
  const [open, setOpen] = useState(false)
  const [shouldFocus, setShouldFocus] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setFocus,
    setValue,
    watch,
  } = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      name: '',
      icon: '',
      price: 0,
      currency: 'USD',
      domain: '',
    },
  })

  const iconValue = watch('icon')

  useEffect(() => {
    if (shouldFocus) {
      setFocus('name')
      setShouldFocus(false)
    }
  }, [shouldFocus, setFocus])

  const onSubmit = (data: SubscriptionFormValues) => {
    addSubscription(data)
    toast.success(`${data.name} added successfully.`)
    reset()
    setShouldFocus(true)
  }

  useEffect(() => {
    if (open) {
      setFocus('name')
    }
  }, [open, setFocus])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button className="group relative overflow-hidden bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 dark:from-emerald-500 dark:to-green-500 dark:hover:from-emerald-600 dark:hover:to-green-600 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
          <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          <PlusCircle className="mr-2 h-4 w-4 relative transition-transform group-hover:rotate-90 duration-300" />
          <span className="relative">Add Subscription</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-card/95 backdrop-blur-sm border-border/50 shadow-xl">
        <form onSubmit={handleSubmit(onSubmit)}>
          <h3 className="font-medium text-lg mb-4">Add Subscription</h3>
          <div className="space-y-4">
            <div>
              <IconUrlInput
                value={iconValue || ''}
                onChange={(value) => setValue('icon', value)}
                label="Icon (optional)"
                error={!!errors.icon}
              />
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input required id="name" {...register('name')} className={errors.name ? 'border-red-500' : ''} />
              <p className="text-red-500 text-xs h-4">{errors.name?.message}</p>
            </div>
            <div className="flex items-start space-x-2">
              <div className="flex-1">
                <Label htmlFor="price">Price</Label>
                <Input
                  id="price"
                  type="number"
                  {...register('price', {
                    valueAsNumber: true,
                  })}
                  className={errors.price ? 'border-red-500' : ''}
                />
                <p className="text-red-500 text-xs h-4">{errors.price?.message}</p>
              </div>
              <div className="flex-1">
                <Label htmlFor="currency">Currency</Label>
                <Select onValueChange={(value) => setValue('currency', value)} defaultValue="USD">
                  <SelectTrigger id="currency" className={errors.currency ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(rates ?? []).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-red-500 text-xs h-4">{errors.currency?.message}</p>
              </div>
            </div>
            <div>
              <Label htmlFor="domain">Domain</Label>
              <Input id="domain" {...register('domain')} className={errors.domain ? 'border-red-500' : ''} />
              <p className="text-red-500 text-xs h-4">{errors.domain?.message}</p>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button type="submit" className="contain-content">
              Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

export default AddSubscriptionPopover
