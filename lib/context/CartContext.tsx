'use client'

import React, { createContext, useCallback, useEffect, useState } from 'react'

export interface CartItem {
  id: string
  quantity: number
}

export interface CartData {
  items: CartItem[]
}

interface CartContextType {
  cart: CartData
  isLoaded: boolean
  addItem: (productId: string, quantity: number) => void
  updateQuantity: (productId: string, quantity: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void
  itemCount: number
}

const CART_STORAGE_KEY = 'maison-doree-cart'

export const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartData>({ items: [] })
  const [isLoaded, setIsLoaded] = useState(false)

  // Load cart from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    const stored = localStorage.getItem(CART_STORAGE_KEY)
    if (stored) {
      try {
        setCart(JSON.parse(stored))
      } catch {
        setCart({ items: [] })
      }
    }
    setIsLoaded(true)
  }, [])

  // Persist cart to localStorage
  const saveCart = useCallback((newCart: CartData) => {
    if (typeof window === 'undefined') return
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCart))
  }, [])

  const addItem = useCallback(
    (productId: string, quantity: number) => {
      setCart((prevCart) => {
        const existingItem = prevCart.items.find((item) => item.id === productId)
        let newItems: CartItem[]

        if (existingItem) {
          newItems = prevCart.items.map((item) =>
            item.id === productId
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          )
        } else {
          newItems = [...prevCart.items, { id: productId, quantity }]
        }

        const newCart = { items: newItems }
        saveCart(newCart)
        return newCart
      })
    },
    [saveCart],
  )

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      setCart((prevCart) => {
        const newItems =
          quantity <= 0
            ? prevCart.items.filter((item) => item.id !== productId)
            : prevCart.items.map((item) =>
                item.id === productId ? { ...item, quantity } : item,
              )

        const newCart = { items: newItems }
        saveCart(newCart)
        return newCart
      })
    },
    [saveCart],
  )

  const removeItem = useCallback(
    (productId: string) => {
      setCart((prevCart) => {
        const newItems = prevCart.items.filter((item) => item.id !== productId)
        const newCart = { items: newItems }
        saveCart(newCart)
        return newCart
      })
    },
    [saveCart],
  )

  const clearCart = useCallback(() => {
    const newCart = { items: [] }
    setCart(newCart)
    saveCart(newCart)
  }, [saveCart])

  const value: CartContextType = {
    cart,
    isLoaded,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    itemCount: cart.items.length,
  }

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  )
}
