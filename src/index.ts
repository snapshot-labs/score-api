import express from 'express';
import cors from 'cors';
import api from './api';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ limit: '8mb', extended: false }));
app.use(cors({ maxAge: 86400 }));
app.use('/api', api);

app.listen(PORT, () => console.log(`Listening at http://localhost:${PORT}`));
