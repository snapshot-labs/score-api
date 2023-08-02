import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rpc from './rpc';
import { rpcError } from './utils';
import { initLogger, fallbackLogger } from '@snapshot-labs/snapshot-sentry';

const app = express();
const PORT = process.env.PORT ?? 3003;

initLogger(app);

app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ limit: '8mb', extended: false }));
app.use(cors({ maxAge: 86400 }));
app.use('/', rpc);

fallbackLogger(app);

app.use((req, res) => {
  rpcError(res, 404, {}, req.body.id);
});

app.listen(PORT, () => console.log(`Listening at http://localhost:${PORT}`));
