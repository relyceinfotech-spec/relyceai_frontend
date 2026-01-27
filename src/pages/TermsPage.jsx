import React from 'react';
import LegalDocumentViewer from '../features/legal/LegalDocumentViewer';
import { TERMS_CONTENT, TERMS_LAST_UPDATED } from '../features/legal/legalContent';

const TermsPage = () => {
    return (
        <LegalDocumentViewer 
            title="Terms of Use"
            lastUpdated={TERMS_LAST_UPDATED}
            content={TERMS_CONTENT}
            pdfUrl="/RelyceAI-Terms-of-Use.pdf"
        />
    );
};

export default TermsPage;
