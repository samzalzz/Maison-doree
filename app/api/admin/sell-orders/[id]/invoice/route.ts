import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import PDFDocument from 'pdfkit'

type RouteContext = { params?: Record<string, string | string[]> }

export const GET = withAdminAuth(async (req: NextRequest, { params }: RouteContext) => {
  const id = params?.id as string | undefined
  if (!id) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Sell order not found.' } },
      { status: 404 },
    )
  }

  try {
    const so = await prisma.sellOrder.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true, address: true, city: true } },
        items: {
          include: {
            material: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    })

    if (!so) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Sell order not found.' } },
        { status: 404 },
      )
    }

    // Create PDF document
    const doc = new PDFDocument({ size: 'A4', margin: 40 })

    // Prepare response
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(10).font('Helvetica').text(`Invoice Number: ${so.orderNumber}`, { align: 'center' })
    doc.text(`Date: ${new Date(so.createdAt).toLocaleDateString()}`, { align: 'center' })
    doc.text(`Status: ${so.status.toUpperCase()}`, { align: 'center' })

    doc.moveDown(1.5)

    // Customer info
    doc.fontSize(12).font('Helvetica-Bold').text('CUSTOMER INFORMATION')
    doc.fontSize(10).font('Helvetica')
    doc.text(`Name: ${so.customer.name}`)
    if (so.customer.email) doc.text(`Email: ${so.customer.email}`)
    if (so.customer.phone) doc.text(`Phone: ${so.customer.phone}`)
    if (so.customer.address) doc.text(`Address: ${so.customer.address}`)
    if (so.customer.city) doc.text(`City: ${so.customer.city}`)

    doc.moveDown(1.5)

    // Delivery info
    doc.fontSize(12).font('Helvetica-Bold').text('DELIVERY DETAILS')
    doc.fontSize(10).font('Helvetica')
    if (so.deliveryDate) doc.text(`Delivery Date: ${new Date(so.deliveryDate).toLocaleDateString()}`)
    if (so.shippedAt) doc.text(`Shipped: ${new Date(so.shippedAt).toLocaleDateString()}`)
    if (so.deliveredAt) doc.text(`Delivered: ${new Date(so.deliveredAt).toLocaleDateString()}`)

    doc.moveDown(1.5)

    // Line items table
    doc.fontSize(12).font('Helvetica-Bold').text('LINE ITEMS')
    doc.moveDown(0.5)

    // Table header
    const startX = 40
    const col1X = startX
    const col2X = col1X + 250
    const col3X = col2X + 80
    const col4X = col3X + 80
    const col5X = col4X + 100

    doc.fontSize(9).font('Helvetica-Bold')
    doc.text('Material', col1X, doc.y, { width: 250 })
    doc.text('Qty', col2X, doc.y - doc.currentLineHeight(), { width: 80 })
    doc.text('Unit', col3X, doc.y - doc.currentLineHeight(), { width: 80 })
    doc.text('Unit Price', col4X, doc.y - doc.currentLineHeight(), { width: 100 })
    doc.text('Line Total', col5X, doc.y - doc.currentLineHeight(), { width: 100, align: 'right' })

    doc.moveTo(startX, doc.y).lineTo(550, doc.y).stroke()
    doc.moveDown(0.5)

    // Line items
    doc.fontSize(9).font('Helvetica')
    let subtotal = 0

    for (const item of so.items) {
      const lineTotal = Number(item.lineTotal || 0)
      subtotal += lineTotal

      doc.text(item.material.name, col1X, doc.y, { width: 250 })
      doc.text(Number(item.quantity).toFixed(2), col2X, doc.y - doc.currentLineHeight(), { width: 80 })
      doc.text(item.material.unit, col3X, doc.y - doc.currentLineHeight(), { width: 80 })
      doc.text(`${Number(item.unitPrice).toFixed(4)}`, col4X, doc.y - doc.currentLineHeight(), { width: 100 })
      doc.text(`${lineTotal.toFixed(2)} DH`, col5X, doc.y - doc.currentLineHeight(), { width: 100, align: 'right' })

      doc.moveDown(0.8)
    }

    doc.moveTo(startX, doc.y).lineTo(550, doc.y).stroke()
    doc.moveDown(0.5)

    // Totals
    const taxAmount = Number(so.taxAmount || 0)
    const totalPrice = Number(so.totalPrice || 0)

    doc.fontSize(10).font('Helvetica')
    doc.text(`Subtotal: ${subtotal.toFixed(2)} DH`, { align: 'right' })
    doc.text(`Tax (20%): ${taxAmount.toFixed(2)} DH`, { align: 'right' })

    doc.moveDown(0.5)
    doc.fontSize(11).font('Helvetica-Bold')
    doc.text(`TOTAL: ${totalPrice.toFixed(2)} DH`, { align: 'right' })

    // Footer
    doc.moveDown(2)
    doc.fontSize(8).font('Helvetica').text('Thank you for your business!', { align: 'center' })

    // Finalize PDF
    doc.end()

    // Wait for PDF to finish and return
    return new Promise((resolve) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks)
        resolve(
          new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="INVOICE-${so.orderNumber}.pdf"`,
            },
          }),
        )
      })
    })
  } catch (error) {
    console.error('[sell-orders/[id]/invoice] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate invoice.' } },
      { status: 500 },
    )
  }
})
