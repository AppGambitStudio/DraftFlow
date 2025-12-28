import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import postRoutes from './routes/posts'; // Renamed from postsRouter
import settingsRoutes from './routes/settings'; // Renamed from settingsRouter
import aiRoutes from './routes/ai'; // New import
import ideaRoutes from './routes/ideas';
import webhookRoutes from './routes/webhooks';
import authRoutes from './routes/auth';
import userAuthRoutes from './routes/userAuth';
import analyticsRoutes from './routes/analytics';
import invitationRoutes from './routes/invitations';
import userRoutes from './routes/users';
import { startScheduler } from './services/scheduler';
import { initDB } from './db';

dotenv.config();

const app = express();
const port = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/posts', postRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/ai', aiRoutes); // New route
app.use('/api/ideas', ideaRoutes); // New route
app.use('/api/webhooks', webhookRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user-auth', userAuthRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/users', userRoutes);

// The /health endpoint was removed in the provided edit snippet.
// app.get('/health', (req, res) => {
//   res.json({ status: 'ok' });
// });

// Initialize DB and start server
initDB().then(() => {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    startScheduler();
  });
});
