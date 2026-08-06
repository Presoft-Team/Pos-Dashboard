import 'dotenv/config'
import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import { openapiSpec } from './openapi/spec'
import { filterOptionsRouter } from './routes/filterOptions'
import { kpiSummaryRouter } from './routes/kpiSummary'
import { salesRouter } from './routes/sales'
import { monthlyRouter } from './routes/monthly'
import { performanceRouter } from './routes/performance'
import { itemsRouter } from './routes/items'

const app = express()
const port = Number(process.env.PORT ?? 4000)

app.use(cors())
app.use(express.json())

app.get('/docs.json', (_req, res) => res.json(openapiSpec))
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec))

app.use('/api/v1', filterOptionsRouter)
app.use('/api/v1', kpiSummaryRouter)
app.use('/api/v1', salesRouter)
app.use('/api/v1', monthlyRouter)
app.use('/api/v1', performanceRouter)
app.use('/api/v1', itemsRouter)

app.get('/', (_req, res) => res.redirect('/docs'))

// Centralized error handler — every route's catch(next(err)) lands here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' })
})

app.listen(port, () => {
  console.log(`presoft-api listening on http://localhost:${port}`)
  console.log(`Swagger UI:            http://localhost:${port}/docs`)
})
