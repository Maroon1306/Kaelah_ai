import 'dotenv/config'
import { app } from './app.js'
import { startLocalDevScheduler } from './modules/agent/agent.scheduler.js'

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
  console.log(`Kaelah AI backend listening on http://localhost:${PORT}`)
  startLocalDevScheduler()
})
