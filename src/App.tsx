import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './screens/Dashboard';
import { Diagnostic } from './screens/Diagnostic';
import { SkillTree } from './screens/SkillTree';
import { Lesson } from './screens/Lesson';
import { Drill } from './screens/Drill';
import { BossFight } from './screens/BossFight';
import { MockExam } from './screens/MockExam';
import { EssayWorkshop } from './screens/EssayWorkshop';
import { ReviewCenter } from './screens/ReviewCenter';
import { Stats } from './screens/Stats';
import { Settings } from './screens/Settings';
import { EnglishDashboard } from './screens/english/EnglishDashboard';
import { EnglishDrill } from './screens/english/EnglishDrill';
import { VocabTrainer } from './screens/english/VocabTrainer';
import { EnglishWriting } from './screens/english/EnglishWriting';
import { AmirnetSimulation } from './screens/english/AmirnetSimulation';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Track A — the two-domain PET */}
        <Route index element={<Dashboard />} />
        <Route path="diagnostic" element={<Diagnostic />} />
        <Route path="map" element={<SkillTree />} />
        <Route path="lesson/:lessonId" element={<Lesson />} />
        <Route path="drill/:topic" element={<Drill />} />
        <Route path="boss" element={<BossFight />} />
        <Route path="mock" element={<MockExam />} />
        <Route path="essay" element={<EssayWorkshop />} />
        <Route path="review" element={<ReviewCenter />} />
        <Route path="stats" element={<Stats />} />
        <Route path="settings" element={<Settings />} />

        {/* Track B — AMIRNET, a parallel section with its own dashboard */}
        <Route path="english" element={<EnglishDashboard />} />
        <Route path="english/drill/:topic" element={<EnglishDrill />} />
        <Route path="english/vocab" element={<VocabTrainer />} />
        <Route path="english/writing" element={<EnglishWriting />} />
        <Route path="english/sim" element={<AmirnetSimulation />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
