import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { cacheMiddleware } from './cache';
import api from './api';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '8mb' }));
app.use(bodyParser.urlencoded({ limit: '8mb', extended: false }));
app.use(cors({ maxAge: 86400 }));
app.use(cacheMiddleware(30));
app.use('/api', api);

app.listen(PORT, () => console.log(`Listening at http://localhost:${PORT}`));
