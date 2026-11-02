import { zodResolver } from '@hookform/resolvers/zod'
import { useLoaderData } from '@remix-run/react'
import type React from 'react'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { BILLING_CYCLES, CYCLE_LABEL, DEFAULT_CYCLE, toISODate } from '~/lib/billing'
import type { loader } from '~/routes/_index'
import type { Subscription } from '~/store/subscriptionStore'
import { IconUrlInput } from './IconFinder'
import SubscriptionCard from './SubscriptionCard'

interface EditSubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (subscription: Omit<Subscription, 'id'>) => void
  editingSubscription: Subscription | null
}

const subscriptionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  price: z.number().min(0.01, 'Price must be greater than 0'),
  currency: z.string().min(1, 'Currency is required'),
  domain: z.string().url('Invalid URL'),
  icon: z.string().optional(),
  billingCycle: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  nextRenewal: z.string().optional(),
})

const EditSubscriptionModal: React.FC<EditSubscriptionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingSubscription,
}) => {
  const { rates } = useLoaderData<typeof loader>()

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      name: '',
      price: 0,
      currency: 'USD',
      domain: '',
      icon: '',
      billingCycle: DEFAULT_CYCLE,
      nextRenewal: toISODate(new Date()),
    },
  })

  useEffect(() => {
    if (editingSubscription) {
      reset({
        ...editingSubscription,
        billingCycle: editingSubscription.billingCycle ?? DEFAULT_CYCLE,
        nextRenewal: editingSubscription.nextRenewal ?? '',
      })
    } else {
      reset({
        name: '',
        price: 0,
        currency: 'USD',
        domain: '',
        icon: '',
        billingCycle: DEFAULT_CYCLE,
        nextRenewal: toISODate(new Date()),
      })
    }
  }, [editingSubscription, reset])

  const watchedFields = watch()

  const previewSubscription: Subscription = {
    id: 'preview',
    name: watchedFields.name || 'Example Subscription',
    price: watchedFields.price || 0,
    currency: watchedFields.currency || 'USD',
    domain: watchedFields.domain || 'https://example.com',
    icon: watchedFields.icon,
    billingCycle: watchedFields.billingCycle || DEFAULT_CYCLE,
    nextRenewal: watchedFields.nextRenewal || undefined,
  }

  const onSubmit = (data: Omit<Subscription, 'id'>) => {
    onSave(data)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] lg:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>{editingSubscription ? 'Edit Subscription' : 'Add Subscription'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div>
                <IconUrlInput
                  value={watchedFields.icon || ''}
                  onChange={(value) => setValue('icon', value)}
                  label="Icon (optional)"
                  error={!!errors.icon}
                />
              </div>
              <div>
                <Label htmlFor="name">Name</Label>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => <Input id="name" {...field} className={errors.name ? 'border-red-500' : ''} />}
                />
                <p className="text-red-500 text-xs h-4">{errors.name?.message || '\u00A0'}</p>
              </div>
              <div>
                <div className="flex items-start space-x-2">
                  <div className="flex-1">
                    <Label htmlFor="price">Price</Label>
                    <Controller
                      name="price"
                      control={control}
                      render={({ field }) => (
                        <Input
                          id="price"
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(Number.parseFloat(e.target.value))}
                          className={errors.price ? 'border-red-500' : ''}
                        />
                      )}
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="currency">Currency</Label>
                    <Controller
                      name="currency"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      )}
                    />
                  </div>
                </div>
                <p className="text-red-500 text-xs h-4">
                  {errors.price?.message || errors.currency?.message || '\u00A0'}
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <div className="flex-1">
                  <Label htmlFor="billingCycle">Billing cycle</Label>
                  <Controller
                    name="billingCycle"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="billingCycle">
                          <SelectValue placeholder="Cycle" />
                        </SelectTrigger>
                        <SelectContent>
                          {BILLING_CYCLES.map((cycle) => (
                            <SelectItem key={cycle} value={cycle}>
                              {CYCLE_LABEL[cycle]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="nextRenewal">Next renewal</Label>
                  <Controller
                    name="nextRenewal"
                    control={control}
                    render={({ field }) => <Input id="nextRenewal" type="date" {...field} value={field.value ?? ''} />}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="domain">Domain</Label>
                <Controller
                  name="domain"
                  control={control}
                  render={({ field }) => (
                    <Input id="domain" {...field} className={errors.domain ? 'border-red-500' : ''} />
                  )}
                />
                <p className="text-red-500 text-xs h-4">{errors.domain?.message || '\u00A0'}</p>
              </div>
            </div>
            <div className="my-auto">
              <SubscriptionCard subscription={previewSubscription} onEdit={() => {}} onDelete={() => {}} />
            </div>
          </div>
          <div className="flex justify-end mt-4 gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <div>
              <Button type="submit" className="contain-content">
                Save
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default EditSubscriptionModal
