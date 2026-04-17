'use client'

import React, { useState, useEffect } from 'react'

interface CountdownTimerProps {
  launchDate: Date
  onLaunchDateReached?: () => void
}

interface TimeRemaining {
  days: number
  hours: number
  minutes: number
  seconds: number
  isLaunched: boolean
}

export default function CountdownTimer({
  launchDate,
  onLaunchDateReached,
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isLaunched: false,
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const calculateTimeRemaining = () => {
      const now = new Date().getTime()
      const launchTime = launchDate.getTime()
      const difference = launchTime - now

      if (difference <= 0) {
        setTimeRemaining({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isLaunched: true,
        })
        onLaunchDateReached?.()
        return
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24))
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((difference / 1000 / 60) % 60)
      const seconds = Math.floor((difference / 1000) % 60)

      setTimeRemaining({
        days,
        hours,
        minutes,
        seconds,
        isLaunched: false,
      })
    }

    calculateTimeRemaining()
    const interval = setInterval(calculateTimeRemaining, 1000)

    return () => clearInterval(interval)
  }, [launchDate, mounted, onLaunchDateReached])

  if (!mounted) {
    return <div className="h-32" />
  }

  if (timeRemaining.isLaunched) {
    return null
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-center">
      <div className="bg-gradient-to-br from-amber-100 to-amber-50 rounded-lg p-6 text-center border-2 border-amber-600">
        <div className="text-4xl font-bold text-amber-900">
          {timeRemaining.days}
        </div>
        <div className="text-sm text-amber-700 font-semibold mt-2">DAYS</div>
      </div>

      <div className="bg-gradient-to-br from-amber-100 to-amber-50 rounded-lg p-6 text-center border-2 border-amber-600">
        <div className="text-4xl font-bold text-amber-900">
          {String(timeRemaining.hours).padStart(2, '0')}
        </div>
        <div className="text-sm text-amber-700 font-semibold mt-2">HOURS</div>
      </div>

      <div className="bg-gradient-to-br from-amber-100 to-amber-50 rounded-lg p-6 text-center border-2 border-amber-600">
        <div className="text-4xl font-bold text-amber-900">
          {String(timeRemaining.minutes).padStart(2, '0')}
        </div>
        <div className="text-sm text-amber-700 font-semibold mt-2">MINS</div>
      </div>

      <div className="bg-gradient-to-br from-amber-100 to-amber-50 rounded-lg p-6 text-center border-2 border-amber-600">
        <div className="text-4xl font-bold text-amber-900">
          {String(timeRemaining.seconds).padStart(2, '0')}
        </div>
        <div className="text-sm text-amber-700 font-semibold mt-2">SECS</div>
      </div>
    </div>
  )
}
