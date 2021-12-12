import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import api from './api';
import rateLimit from './rateLimit';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '8mb' }));
app.use(bodyParser.urlencoded({ limit: '8mb', extended: false }));
app.use(cors({ maxAge: 86400 }));
app.set('trust proxy', 1);
app.use(rateLimit);
app.use('/api', api);

app.listen(PORT, () => console.log(`Listening at http://localhost:${PORT}`));
