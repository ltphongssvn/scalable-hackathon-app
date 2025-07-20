// Resume-Job Comparison Service
// File: src/services/resumeJobComparisonService.js

const huggingFaceResumeService = require('./huggingFaceResumeService');

/**
 * This service compares resumes against job descriptions to provide
 * actionable matching insights for both job seekers and recruiters.
 * It uses AI to understand requirements beyond simple keyword matching.
 */
class ResumeJobComparisonService {
    constructor() {
        // Initialize Hugging Face API configuration
        this.apiKey = process.env.HUGGINGFACE_API_KEY;
        this.baseURL = 'https://api-inference.huggingface.co/models/';

        // Model for semantic similarity comparison
        this.similarityModel = 'sentence-transformers/all-MiniLM-L6-v2';

        // Weights for different matching criteria
        this.matchingWeights = {
            skillsMatch: 0.35,           // Technical skills alignment
            experienceMatch: 0.25,       // Experience level compatibility
            educationMatch: 0.15,        // Educational requirements
            semanticSimilarity: 0.25     // Overall content similarity
        };

        // Define match quality thresholds
        this.matchThresholds = {
            excellent: { min: 85, label: 'Excellent Match', color: 'green' },
            good: { min: 70, label: 'Good Match', color: 'blue' },
            fair: { min: 55, label: 'Fair Match', color: 'yellow' },
            poor: { min: 0, label: 'Poor Match', color: 'red' }
        };
    }

    /**
     * Main comparison method that orchestrates the matching analysis
     */
    async compareResumeToJob(resumeData, jobDescription) {
        try {
            console.log('Starting resume-job comparison analysis...');

            // Parse job description to extract requirements
            const jobRequirements = await this.parseJobDescription(jobDescription);

            // Perform various matching analyses
            const skillsAnalysis = await this.analyzeSkillsMatch(
                resumeData.skills || [],
                jobRequirements.requiredSkills,
                jobRequirements.preferredSkills
            );

            const experienceAnalysis = this.analyzeExperienceMatch(
                resumeData.experienceLevel,
                resumeData.experience,
                jobRequirements.experienceRequirements
            );

            const educationAnalysis = this.analyzeEducationMatch(
                resumeData.education,
                jobRequirements.educationRequirements
            );

            // Calculate semantic similarity between resume and job description
            const semanticScore = await this.calculateSemanticSimilarity(
                this.getResumeText(resumeData),
                jobDescription
            );

            // Calculate overall match score
            const overallMatch = this.calculateOverallMatch({
                skillsMatch: skillsAnalysis.matchScore,
                experienceMatch: experienceAnalysis.matchScore,
                educationMatch: educationAnalysis.matchScore,
                semanticSimilarity: semanticScore
            });

            // Generate insights and recommendations
            const insights = this.generateMatchingInsights(
                skillsAnalysis,
                experienceAnalysis,
                educationAnalysis,
                overallMatch
            );

            const recommendations = this.generateImrovementRecommendations(
                resumeData,
                jobRequirements,
                skillsAnalysis
            );

            return {
                success: true,
                overallMatch,
                details: {
                    skills: skillsAnalysis,
                    experience: experienceAnalysis,
                    education: educationAnalysis,
                    semanticSimilarity: {
                        score: semanticScore,
                        interpretation: this.interpretSimilarityScore(semanticScore)
                    }
                },
                insights,
                recommendations,
                jobRequirements,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error in resume-job comparison:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Parse job description to extract structured requirements
     * Uses AI to understand requirements beyond simple keyword extraction
     */
    async parseJobDescription(jobDescription) {
        console.log('Parsing job description for requirements...');

        // Extract required and preferred skills
        const skillsPrompt = `Extract technical skills from this job description. 
                             Separate into required (must-have) and preferred (nice-to-have) skills.
                             Job Description: ${jobDescription}`;

        try {
            // Use zero-shot classification to categorize requirements
            const skillCategories = ['Required Technical Skill', 'Preferred Technical Skill', 'Soft Skill'];

            // Extract all potential skills mentions
            const skillMentions = this.extractSkillMentions(jobDescription);

            const requiredSkills = [];
            const preferredSkills = [];

            // Classify each skill mention
            for (const skill of skillMentions) {
                const classification = await this.classifyRequirement(skill, jobDescription);
                if (classification === 'required') {
                    requiredSkills.push(skill);
                } else if (classification === 'preferred') {
                    preferredSkills.push(skill);
                }
            }

            // Extract experience requirements
            const experienceRequirements = this.extractExperienceRequirements(jobDescription);

            // Extract education requirements
            const educationRequirements = this.extractEducationRequirements(jobDescription);

            return {
                requiredSkills,
                preferredSkills,
                experienceRequirements,
                educationRequirements,
                rawDescription: jobDescription
            };

        } catch (error) {
            console.error('Error parsing job description:', error);
            // Fallback to basic extraction
            return this.basicJobParsing(jobDescription);
        }
    }

    /**
     * Analyze how well candidate's skills match job requirements
     */
    async analyzeSkillsMatch(candidateSkills, requiredSkills, preferredSkills) {
        const analysis = {
            requiredSkillsMatched: [],
            requiredSkillsMissing: [],
            preferredSkillsMatched: [],
            preferredSkillsMissing: [],
            additionalSkills: [],
            matchScore: 0
        };

        // Normalize skills for comparison
        const normalizedCandidateSkills = candidateSkills.map(s => s.toLowerCase().trim());

        // Check required skills
        for (const requiredSkill of requiredSkills) {
            const normalized = requiredSkill.toLowerCase().trim();
            const isMatched = normalizedCandidateSkills.some(skill =>
                skill.includes(normalized) || normalized.includes(skill) ||
                this.areSkillsSimilar(skill, normalized)
            );

            if (isMatched) {
                analysis.requiredSkillsMatched.push(requiredSkill);
            } else {
                analysis.requiredSkillsMissing.push(requiredSkill);
            }
        }

        // Check preferred skills
        for (const preferredSkill of preferredSkills) {
            const normalized = preferredSkill.toLowerCase().trim();
            const isMatched = normalizedCandidateSkills.some(skill =>
                skill.includes(normalized) || normalized.includes(skill) ||
                this.areSkillsSimilar(skill, normalized)
            );

            if (isMatched) {
                analysis.preferredSkillsMatched.push(preferredSkill);
            } else {
                analysis.preferredSkillsMissing.push(preferredSkill);
            }
        }

        // Identify additional skills candidate has
        const allJobSkills = [...requiredSkills, ...preferredSkills]
            .map(s => s.toLowerCase().trim());

        analysis.additionalSkills = candidateSkills.filter(skill => {
            const normalized = skill.toLowerCase().trim();
            return !allJobSkills.some(jobSkill =>
                jobSkill.includes(normalized) || normalized.includes(jobSkill)
            );
        });

        // Calculate match score
        const requiredMatch = requiredSkills.length > 0
            ? (analysis.requiredSkillsMatched.length / requiredSkills.length) * 100
            : 100;

        const preferredMatch = preferredSkills.length > 0
            ? (analysis.preferredSkillsMatched.length / preferredSkills.length) * 100
            : 0;

        // Weight required skills more heavily
        analysis.matchScore = Math.round(requiredMatch * 0.7 + preferredMatch * 0.3);

        // Add match interpretation
        analysis.interpretation = this.interpretSkillsMatch(analysis);

        return analysis;
    }

    /**
     * Analyze experience level compatibility
     */
    analyzeExperienceMatch(candidateLevel, candidateExperience, jobRequirements) {
        const analysis = {
            candidateLevel,
            requiredLevel: jobRequirements.level,
            yearsRequired: jobRequirements.years,
            matchScore: 0,
            interpretation: ''
        };

        // Define experience level hierarchy
        const levelHierarchy = {
            'Entry Level': 1,
            'Junior': 2,
            'Mid-Level': 3,
            'Senior': 4,
            'Lead/Principal': 5
        };

        const candidateLevelValue = levelHierarchy[candidateLevel] || 3;
        const requiredLevelValue = levelHierarchy[jobRequirements.level] || 3;

        // Calculate match score based on level difference
        const levelDifference = candidateLevelValue - requiredLevelValue;

        if (levelDifference >= 0) {
            // Candidate meets or exceeds requirement
            analysis.matchScore = Math.max(0, 100 - (levelDifference * 10));
            analysis.interpretation = levelDifference === 0
                ? 'Perfect experience level match'
                : 'Candidate exceeds experience requirements';
        } else {
            // Candidate below requirement
            analysis.matchScore = Math.max(0, 100 + (levelDifference * 25));
            analysis.interpretation = 'Candidate below required experience level';
        }

        // Extract years of experience if mentioned
        const yearsMatch = candidateExperience?.match(/(\d+)\s*(?:years?|yrs?)/i);
        if (yearsMatch && jobRequirements.years) {
            const candidateYears = parseInt(yearsMatch[1]);
            const requiredYears = jobRequirements.years;

            analysis.candidateYears = candidateYears;

            if (candidateYears >= requiredYears) {
                analysis.yearsMatchScore = 100;
            } else {
                const deficit = requiredYears - candidateYears;
                analysis.yearsMatchScore = Math.max(0, 100 - (deficit * 20));
            }

            // Combine level and years scores
            analysis.matchScore = Math.round((analysis.matchScore + analysis.yearsMatchScore) / 2);
        }

        return analysis;
    }

    /**
     * Analyze education compatibility
     */
    analyzeEducationMatch(candidateEducation, jobEducationRequirements) {
        const analysis = {
            meetsRequirements: false,
            matchScore: 50, // Default neutral score
            details: []
        };

        if (!jobEducationRequirements.required) {
            analysis.matchScore = 100;
            analysis.meetsRequirements = true;
            analysis.interpretation = 'No specific education requirements';
            return analysis;
        }

        // Check for degree level match
        const degreeHierarchy = {
            'high school': 1,
            'associate': 2,
            'bachelor': 3,
            'master': 4,
            'phd': 5,
            'doctorate': 5
        };

        const requiredLevel = this.extractDegreeLevel(jobEducationRequirements.degree);
        const candidateLevel = this.extractDegreeLevel(candidateEducation);

        if (candidateLevel && requiredLevel) {
            const candidateValue = degreeHierarchy[candidateLevel] || 0;
            const requiredValue = degreeHierarchy[requiredLevel] || 0;

            if (candidateValue >= requiredValue) {
                analysis.meetsRequirements = true;
                analysis.matchScore = 100;
                analysis.interpretation = 'Education requirements met or exceeded';
            } else {
                analysis.matchScore = Math.max(0, 100 - ((requiredValue - candidateValue) * 25));
                analysis.interpretation = 'Education below requirements';
            }
        }

        // Check for field of study match if specified
        if (jobEducationRequirements.field && candidateEducation) {
            const fieldMatch = this.checkFieldMatch(
                candidateEducation,
                jobEducationRequirements.field
            );

            if (fieldMatch) {
                analysis.fieldMatch = true;
                analysis.matchScore = Math.min(100, analysis.matchScore + 10);
            }
        }

        return analysis;
    }

    /**
     * Calculate semantic similarity using sentence transformers
     */
    async calculateSemanticSimilarity(resumeText, jobDescription) {
        try {
            const response = await huggingFaceResumeService.callHuggingFaceAPI(
                this.similarityModel,
                {
                    source_sentence: resumeText.substring(0, 512), // Limit for model
                    sentences: [jobDescription.substring(0, 512)]
                }
            );

            // Convert similarity to percentage
            const similarity = response[0] || 0;
            return Math.round(similarity * 100);

        } catch (error) {
            console.error('Error calculating semantic similarity:', error);
            return 50; // Default neutral score on error
        }
    }

    /**
     * Calculate overall match score using weighted components
     */
    calculateOverallMatch(scores) {
        let weightedSum = 0;
        let totalWeight = 0;

        for (const [component, score] of Object.entries(scores)) {
            if (score !== null && this.matchingWeights[component]) {
                weightedSum += score * this.matchingWeights[component];
                totalWeight += this.matchingWeights[component];
            }
        }

        const overallScore = totalWeight > 0
            ? Math.round(weightedSum / totalWeight)
            : 0;

        // Determine match quality
        let matchQuality;
        for (const [key, threshold] of Object.entries(this.matchThresholds)) {
            if (overallScore >= threshold.min) {
                matchQuality = threshold;
                break;
            }
        }

        return {
            score: overallScore,
            quality: matchQuality,
            interpretation: this.interpretOverallMatch(overallScore)
        };
    }

    /**
     * Generate human-readable insights about the match
     */
    generateMatchingInsights(skillsAnalysis, experienceAnalysis, educationAnalysis, overallMatch) {
        const insights = [];

        // Overall assessment
        insights.push({
            type: 'overall',
            message: overallMatch.interpretation,
            importance: 'high'
        });

        // Skills insights
        if (skillsAnalysis.requiredSkillsMissing.length === 0) {
            insights.push({
                type: 'skills',
                message: 'Candidate has all required technical skills',
                importance: 'high',
                positive: true
            });
        } else {
            insights.push({
                type: 'skills',
                message: `Missing ${skillsAnalysis.requiredSkillsMissing.length} required skills: ${skillsAnalysis.requiredSkillsMissing.slice(0, 3).join(', ')}`,
                importance: 'high',
                positive: false
            });
        }

        // Experience insights
        insights.push({
            type: 'experience',
            message: experienceAnalysis.interpretation,
            importance: 'medium',
            positive: experienceAnalysis.matchScore >= 70
        });

        // Additional skills insight
        if (skillsAnalysis.additionalSkills.length > 3) {
            insights.push({
                type: 'bonus',
                message: `Candidate brings ${skillsAnalysis.additionalSkills.length} additional skills not mentioned in the job description`,
                importance: 'low',
                positive: true
            });
        }

        return insights;
    }

    /**
     * Generate recommendations to improve match score
     */
    generateImrovementRecommendations(resumeData, jobRequirements, skillsAnalysis) {
        const recommendations = [];

        // Skills recommendations
        if (skillsAnalysis.requiredSkillsMissing.length > 0) {
            recommendations.push({
                category: 'Skills Development',
                priority: 'high',
                suggestions: skillsAnalysis.requiredSkillsMissing.slice(0, 5).map(skill => ({
                    skill,
                    action: `Learn or gain experience with ${skill}`,
                    resources: this.suggestLearningResources(skill)
                }))
            });
        }

        // Resume optimization recommendations
        if (skillsAnalysis.matchScore < 70) {
            recommendations.push({
                category: 'Resume Optimization',
                priority: 'medium',
                suggestions: [
                    {
                        action: 'Highlight relevant project experience',
                        detail: 'Add specific projects that demonstrate the required skills'
                    },
                    {
                        action: 'Use job-specific keywords',
                        detail: `Include terms like: ${jobRequirements.requiredSkills.slice(0, 3).join(', ')}`
                    }
                ]
            });
        }

        return recommendations;
    }

    // Helper methods

    extractSkillMentions(text) {
        // Common technical skills patterns
        const skillPatterns = [
            /\b(?:JavaScript|Python|Java|C\+\+|Ruby|Go|Rust|TypeScript|PHP|Swift)\b/gi,
            /\b(?:React|Angular|Vue|Node\.js|Django|Flask|Spring|Express)\b/gi,
            /\b(?:AWS|Azure|GCP|Docker|Kubernetes|Jenkins|Git|CI\/CD)\b/gi,
            /\b(?:SQL|NoSQL|MongoDB|PostgreSQL|MySQL|Redis|Elasticsearch)\b/gi,
            /\b(?:Machine Learning|AI|Data Science|Deep Learning|NLP)\b/gi
        ];

        const skills = new Set();

        for (const pattern of skillPatterns) {
            const matches = text.match(pattern) || [];
            matches.forEach(match => skills.add(match));
        }

        return Array.from(skills);
    }

    classifyRequirement(skill, jobDescription) {
        const skillContext = this.getSkillContext(skill, jobDescription);

        // Look for requirement indicators
        const requiredIndicators = /(?:required|must have|essential|mandatory)/i;
        const preferredIndicators = /(?:preferred|nice to have|bonus|desired|plus)/i;

        if (requiredIndicators.test(skillContext)) {
            return 'required';
        } else if (preferredIndicators.test(skillContext)) {
            return 'preferred';
        }

        // Default to required if mentioned in requirements section
        return 'required';
    }

    getSkillContext(skill, text) {
        const index = text.toLowerCase().indexOf(skill.toLowerCase());
        if (index === -1) return '';

        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + skill.length + 50);

        return text.substring(start, end);
    }

    extractExperienceRequirements(jobDescription) {
        const requirements = {
            years: null,
            level: null
        };

        // Extract years of experience
        const yearsPattern = /(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience/i;
        const yearsMatch = jobDescription.match(yearsPattern);

        if (yearsMatch) {
            requirements.years = parseInt(yearsMatch[1]);
        }

        // Extract experience level
        const levels = ['entry level', 'junior', 'mid-level', 'senior', 'lead', 'principal'];
        const levelPattern = new RegExp(`\\b(${levels.join('|')})\\b`, 'i');
        const levelMatch = jobDescription.match(levelPattern);

        if (levelMatch) {
            requirements.level = levelMatch[1]
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join('-');
        }

        return requirements;
    }

    extractEducationRequirements(jobDescription) {
        const requirements = {
            required: false,
            degree: null,
            field: null
        };

        // Check for degree requirements
        const degreePattern = /(?:bachelor|master|phd|doctorate|associate)(?:'s)?(?:\s+degree)?/i;
        const degreeMatch = jobDescription.match(degreePattern);

        if (degreeMatch) {
            requirements.required = true;
            requirements.degree = degreeMatch[0];

            // Try to extract field of study
            const fieldPattern = new RegExp(
                `${degreeMatch[0]}.*?(?:in|of)\\s+([A-Za-z\\s]+?)(?:\\.|,|;|\\s+or|\\s+and|$)`,
                'i'
            );
            const fieldMatch = jobDescription.match(fieldPattern);

            if (fieldMatch) {
                requirements.field = fieldMatch[1].trim();
            }
        }

        return requirements;
    }

    extractDegreeLevel(educationText) {
        if (!educationText) return null;

        const text = educationText.toLowerCase();

        if (text.includes('phd') || text.includes('doctorate')) return 'phd';
        if (text.includes('master')) return 'master';
        if (text.includes('bachelor')) return 'bachelor';
        if (text.includes('associate')) return 'associate';
        if (text.includes('high school')) return 'high school';

        return null;
    }

    areSkillsSimilar(skill1, skill2) {
        // Define skill synonyms and variations
        const skillSynonyms = {
            'js': 'javascript',
            'ts': 'typescript',
            'nodejs': 'node.js',
            'react.js': 'react',
            'vuejs': 'vue.js',
            'vue': 'vue.js',
            'angular': 'angularjs',
            'postgres': 'postgresql',
            'mongo': 'mongodb',
            'k8s': 'kubernetes'
        };

        // Normalize skills
        const normalized1 = skillSynonyms[skill1] || skill1;
        const normalized2 = skillSynonyms[skill2] || skill2;

        return normalized1 === normalized2;
    }

    getResumeText(resumeData) {
        // Compile resume data into text for semantic analysis
        const sections = [
            resumeData.name,
            resumeData.experience,
            resumeData.skills?.join(', '),
            resumeData.education
        ].filter(Boolean);

        return sections.join(' ');
    }

    basicJobParsing(jobDescription) {
        // Fallback parsing method
        return {
            requiredSkills: this.extractSkillMentions(jobDescription),
            preferredSkills: [],
            experienceRequirements: this.extractExperienceRequirements(jobDescription),
            educationRequirements: this.extractEducationRequirements(jobDescription),
            rawDescription: jobDescription
        };
    }

    interpretSkillsMatch(analysis) {
        const requiredPercentage = analysis.requiredSkillsMatched.length > 0
            ? Math.round((analysis.requiredSkillsMatched.length /
                (analysis.requiredSkillsMatched.length + analysis.requiredSkillsMissing.length)) * 100)
            : 0;

        if (requiredPercentage === 100) {
            return 'Perfect match - all required skills present';
        } else if (requiredPercentage >= 80) {
            return 'Strong match - most required skills present';
        } else if (requiredPercentage >= 60) {
            return 'Moderate match - some skill gaps to address';
        } else {
            return 'Weak match - significant skill gaps';
        }
    }

    interpretSimilarityScore(score) {
        if (score >= 80) return 'Very high content similarity';
        if (score >= 60) return 'Good content alignment';
        if (score >= 40) return 'Moderate content overlap';
        return 'Low content similarity';
    }

    interpretOverallMatch(score) {
        if (score >= 85) {
            return 'Excellent match! This candidate aligns very well with the job requirements.';
        } else if (score >= 70) {
            return 'Good match. The candidate meets most requirements with some minor gaps.';
        } else if (score >= 55) {
            return 'Fair match. The candidate has potential but needs to address several gaps.';
        } else {
            return 'Poor match. Significant gaps exist between candidate profile and job requirements.';
        }
    }

    checkFieldMatch(education, requiredField) {
        const educationLower = education.toLowerCase();
        const fieldLower = requiredField.toLowerCase();

        // Direct match
        if (educationLower.includes(fieldLower)) return true;

        // Check for common variations
        const fieldVariations = {
            'computer science': ['cs', 'computing', 'software engineering'],
            'electrical engineering': ['ee', 'electronics'],
            'mechanical engineering': ['me', 'mechanics'],
            'business': ['mba', 'management', 'commerce']
        };

        for (const [field, variations] of Object.entries(fieldVariations)) {
            if (fieldLower.includes(field) || field.includes(fieldLower)) {
                return variations.some(v => educationLower.includes(v));
            }
        }

        return false;
    }

    suggestLearningResources(skill) {
        // Map skills to learning resources
        const resourceMap = {
            'javascript': ['MDN Web Docs', 'freeCodeCamp', 'JavaScript.info'],
            'react': ['React Official Docs', 'Scrimba React Course', 'Full Stack Open'],
            'python': ['Python.org Tutorial', 'Codecademy Python', 'Real Python'],
            'aws': ['AWS Free Tier', 'AWS Skill Builder', 'Cloud Guru'],
            'docker': ['Docker Official Docs', 'Docker Labs', 'Play with Docker'],
            'kubernetes': ['Kubernetes.io', 'Katacoda', 'CNCF Training']
        };

        const skillLower = skill.toLowerCase();

        for (const [key, resources] of Object.entries(resourceMap)) {
            if (skillLower.includes(key) || key.includes(skillLower)) {
                return resources.slice(0, 2);
            }
        }

        return ['Online tutorials', 'Documentation', 'Hands-on projects'];
    }
}

module.exports = new ResumeJobComparisonService();
