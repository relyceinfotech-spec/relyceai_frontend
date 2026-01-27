import React from 'react';
import LegalDocumentViewer from '../features/legal/LegalDocumentViewer';
import { PRIVACY_CONTENT, PRIVACY_LAST_UPDATED } from '../features/legal/legalContent';

const PrivacyPage = () => {
    return (
        <LegalDocumentViewer 
            title="Privacy Policy"
            lastUpdated={PRIVACY_LAST_UPDATED}
            content={PRIVACY_CONTENT}
            pdfUrl="/RelyceAI-Privacy-Policy.pdf"
        />
    );
};

export default PrivacyPage;
