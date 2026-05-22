import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { CampaignListScreen } from './screens/CampaignListScreen'
import { CampaignViewScreen } from './screens/CampaignViewScreen'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<CampaignListScreen />} />
      <Route path="/campaign/:id" element={<CampaignViewScreen />} />
    </Routes>
  )
}
