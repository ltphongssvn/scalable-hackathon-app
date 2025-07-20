// Confidence Scoring Service
// File: src/services/confidenceScoreService.js

/**
 * This service calculates and manages confidence scores for AI-processed resumes.
 * It aggregates multiple AI confidence metrics into meaningful scores that help
 * users understand how reliable the AI's analysis is.
 */

class ConfidenceScoreService {
    constructor() {
        // Define weights for different aspects of the resume analysis
        // These weights reflect the relative importance of each component
        this.componentWeights = {
            transcriptionQuality: 0.20,      // How well the audio was transcribed
            nameExtraction: 0.15,            // Confidence in identifying the person's name
            contactExtraction: 0.10,         // Confidence in email/phone extraction
            skillsCategorization: 0.20,      // How well skills were categorized
            experienceLevelInference: 0.15,  // Confidence in experience level assessment
            entityRecognition: 0.10,         // Quality of organization/location detection
            overallCompleteness: 0.10        // How complete the resume information is
        };

        // Define thresholds for confidence levels
        this.confidenceLevels = {
            high: { min: 80, label: 'High Confidence', color: 'green' },
            medium: { min: 60, label: 'Medium Confidence', color: 'yellow' },
            low: { min: 40, label: 'Low Confidence', color: 'orange' },
            veryLow: { min: 0, label: 'Very Low Confidence', color: 'red' }
        };
    }

    /**
     * Calculate the overall confidence score for a resume
     * This method takes various AI outputs and creates a unified confidence metric
     */
    calculateOverallConfidence(resumeData) {
        const scores = {
            transcriptionQuality: this.calculateTranscriptionScore(resumeData),
            nameExtraction: this.calculateNameExtractionScore(resumeData),
            contactExtraction: this.calculateContactExtractionScore(resumeData),
            skillsCategorization: this.calculateSkillsCategorizationScore(resumeData),
            experienceLevelInference: this.calculateExperienceLevelScore(resumeData),
            entityRecognition: this.calculateEntityRecognitionScore(resumeData),
            overallCompleteness: this.calculateCompletenessScore(resumeData)
        };

        // Calculate weighted average
        let weightedSum = 0;
        let totalWeight = 0;

        for (const [component, score] of Object.entries(scores)) {
            if (score !== null && this.componentWeights[component]) {
                weightedSum += score * this.componentWeights[component];
                totalWeight += this.componentWeights[component];
            }
        }

        const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

        // Determine confidence level
        const level = this.getConfidenceLevel(overallScore);

        // Generate insights about the confidence score
        const insights = this.generateConfidenceInsights(scores, overallScore);

        return {
            overallScore,
            level,
            componentScores: scores,
            insights,
            recommendations: this.generateRecommendations(scores),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Calculate confidence score for transcription quality
     * Based on Whisper's quality metrics
     */
    calculateTranscriptionScore(resumeData) {
        if (!resumeData.transcriptionQuality) return null;

        const quality = resumeData.transcriptionQuality;
        let score = 100;

        // Deduct points for quality issues
        if (quality.audioQuality === 'poor') score -= 30;
        else if (quality.audioQuality === 'fair') score -= 15;

        if (quality.backgroundNoise === 'high') score -= 20;
        else if (quality.backgroundNoise === 'moderate') score -= 10;

        if (quality.clarity < 0.7) score -= 25;
        else if (quality.clarity < 0.85) score -= 10;

        // Consider speech pace
        if (quality.speechPace === 'very_fast' || quality.speechPace === 'very_slow') {
            score -= 15;
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calculate confidence for name extraction
     * Based on entity recognition confidence and name validation
     */
    calculateNameExtractionScore(resumeData) {
        if (!resumeData.name || !resumeData.huggingFaceEnhancement?.entities) {
            return resumeData.name ? 70 : 0; // Default score if name exists but no AI validation
        }

        const entities = resumeData.huggingFaceEnhancement.entities;
        const persons = entities.persons || [];

        // Check if the extracted name matches a high-confidence person entity
        const nameMatch = persons.find(p =>
            p.text.toLowerCase().includes(resumeData.name.toLowerCase()) ||
            resumeData.name.toLowerCase().includes(p.text.toLowerCase())
        );

        if (nameMatch) {
            return Math.round(nameMatch.score * 100);
        }

        // If name exists but wasn't found in entities, give moderate confidence
        return 60;
    }

    /**
     * Calculate confidence for contact information extraction
     */
    calculateContactExtractionScore(resumeData) {
        let score = 100;
        const penalties = {
            missingEmail: 30,
            invalidEmailFormat: 20,
            missingPhone: 20,
            invalidPhoneFormat: 15
        };

        // Check email
        if (!resumeData.email) {
            score -= penalties.missingEmail;
        } else if (!this.isValidEmail(resumeData.email)) {
            score -= penalties.invalidEmailFormat;
        }

        // Check phone
        if (!resumeData.phone) {
            score -= penalties.missingPhone;
        } else if (!this.isValidPhone(resumeData.phone)) {
            score -= penalties.invalidPhoneFormat;
        }

        return Math.max(0, score);
    }

    /**
     * Calculate confidence for skills categorization
     */
    calculateSkillsCategorizationScore(resumeData) {
        if (!resumeData.huggingFaceEnhancement?.categorizedSkills) {
            return resumeData.skills?.length > 0 ? 50 : 0;
        }

        const categorizedSkills = resumeData.huggingFaceEnhancement.categorizedSkills;
        let totalScore = 0;
        let skillCount = 0;

        // Average the confidence scores for each skill categorization
        categorizedSkills.forEach(skill => {
            if (skill.categories && skill.categories.length > 0) {
                // Use the highest confidence category for each skill
                const maxCategoryScore = Math.max(...skill.categories.map(c => c.score));
                totalScore += maxCategoryScore * 100;
                skillCount++;
            }
        });

        return skillCount > 0 ? Math.round(totalScore / skillCount) : 0;
    }

    /**
     * Calculate confidence for experience level inference
     */
    calculateExperienceLevelScore(resumeData) {
        if (!resumeData.experienceLevelConfidence) {
            return null;
        }

        // Convert the raw confidence (0-1) to a percentage
        // Apply a curve to make the scoring more intuitive
        const rawConfidence = resumeData.experienceLevelConfidence;

        // Apply a slight boost to low-confidence predictions
        // This reflects that even low-confidence predictions have some value
        const adjustedScore = 40 + (rawConfidence * 60);

        return Math.round(adjustedScore);
    }

    /**
     * Calculate confidence for entity recognition
     */
    calculateEntityRecognitionScore(resumeData) {
        if (!resumeData.huggingFaceEnhancement?.entities) {
            return null;
        }

        const entities = resumeData.huggingFaceEnhancement.entities;
        const allEntities = [
            ...(entities.organizations || []),
            ...(entities.locations || []),
            ...(entities.persons || [])
        ];

        if (allEntities.length === 0) {
            return 50; // No entities found, neutral score
        }

        // Calculate average confidence of all detected entities
        const avgConfidence = allEntities.reduce((sum, entity) => sum + entity.score, 0) / allEntities.length;

        return Math.round(avgConfidence * 100);
    }

    /**
     * Calculate completeness score
     */
    calculateCompletenessScore(resumeData) {
        if (!resumeData.completenessScore) {
            return null;
        }

        return resumeData.completenessScore.score;
    }

    /**
     * Determine confidence level based on score
     */
    getConfidenceLevel(score) {
        for (const [key, level] of Object.entries(this.confidenceLevels)) {
            if (score >= level.min) {
                return level;
            }
        }
        return this.confidenceLevels.veryLow;
    }

    /**
     * Generate human-readable insights about the confidence score
     */
    generateConfidenceInsights(scores, overallScore) {
        const insights = [];

        // Overall assessment
        if (overallScore >= 80) {
            insights.push("The AI analysis of this resume is highly reliable. All major components were successfully processed with high confidence.");
        } else if (overallScore >= 60) {
            insights.push("The AI analysis is generally reliable, though some components showed moderate confidence levels.");
        } else {
            insights.push("The AI analysis has lower confidence. Manual review is recommended for accuracy.");
        }

        // Component-specific insights
        if (scores.transcriptionQuality < 60) {
            insights.push("Audio quality issues may have affected transcription accuracy. Consider re-recording in a quieter environment.");
        }

        if (scores.nameExtraction < 70) {
            insights.push("The AI had some difficulty identifying the candidate's name with high confidence.");
        }

        if (scores.skillsCategorization > 80) {
            insights.push("Skills were categorized with high confidence, providing reliable skill taxonomy.");
        }

        if (scores.experienceLevelInference < 50) {
            insights.push("Experience level inference has low confidence. The resume may lack clear experience indicators.");
        }

        return insights;
    }

    /**
     * Generate recommendations to improve confidence scores
     */
    generateRecommendations(scores) {
        const recommendations = [];

        // Prioritize recommendations by impact
        const scoreImpacts = Object.entries(scores)
            .filter(([_, score]) => score !== null && score < 70)
            .sort(([_, a], [__, b]) => a - b);

        for (const [component, score] of scoreImpacts) {
            switch (component) {
                case 'transcriptionQuality':
                    recommendations.push({
                        component: 'Audio Quality',
                        issue: 'Low transcription confidence',
                        suggestion: 'Record in a quiet room with minimal background noise',
                        impact: 'high'
                    });
                    break;

                case 'nameExtraction':
                    recommendations.push({
                        component: 'Name Recognition',
                        issue: 'Difficulty identifying name',
                        suggestion: 'Clearly state your full name at the beginning',
                        impact: 'medium'
                    });
                    break;

                case 'contactExtraction':
                    recommendations.push({
                        component: 'Contact Information',
                        issue: 'Missing or unclear contact details',
                        suggestion: 'Spell out email address and phone number clearly',
                        impact: 'high'
                    });
                    break;

                case 'skillsCategorization':
                    recommendations.push({
                        component: 'Skills',
                        issue: 'Difficulty categorizing skills',
                        suggestion: 'Mention specific technologies and tools by name',
                        impact: 'medium'
                    });
                    break;

                case 'experienceLevelInference':
                    recommendations.push({
                        component: 'Experience Level',
                        issue: 'Unclear experience indicators',
                        suggestion: 'Mention years of experience and role levels explicitly',
                        impact: 'medium'
                    });
                    break;
            }
        }

        return recommendations.slice(0, 3); // Return top 3 recommendations
    }

    /**
     * Validate email format
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate phone format
     */
    isValidPhone(phone) {
        // Remove all non-digits
        const digitsOnly = phone.replace(/\D/g, '');
        // Check if it's a reasonable phone number length (7-15 digits)
        return digitsOnly.length >= 7 && digitsOnly.length <= 15;
    }

    /**
     * Store confidence scores in the database
     */
    async storeConfidenceScores(resumeId, confidenceData) {
        const { query } = require('../config/database');

        try {
            await query(
                `UPDATE resumes 
                 SET confidence_scores = $1,
                     last_analysis_at = NOW()
                 WHERE id = $2`,
                [JSON.stringify(confidenceData), resumeId]
            );

            console.log(`Confidence scores stored for resume ${resumeId}`);
        } catch (error) {
            console.error('Error storing confidence scores:', error);
            throw error;
        }
    }
}

module.exports = new ConfidenceScoreService();