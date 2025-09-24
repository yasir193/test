import Joi from 'joi';
export const validateUser = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\s\u0600-\u06FF]+$/)
      .required()
      .messages({
        'string.empty': 'Name is required',
        'string.min': 'Name should have at least 2 characters',
        'string.max': 'Name should not exceed 50 characters',
        'string.pattern.base': 'Name must contain only letters and spaces (Arabic and English)'
      }),
    
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.empty': 'Email is required',
        'string.pattern.base': 'Email format is invalid'
      }),
    
    job_title: Joi.string()
      .max(100)
      .pattern(/^[a-zA-Z\s\u0600-\u06FF]+$/)
      .optional()
      .messages({
        'string.max': 'Job title should not exceed 100 characters',
        'string.pattern.base': 'Job title must contain only letters and spaces (Arabic and English)'
      }),
    
    typeOfUser: Joi.string()
      .valid('person', 'business')
      .required()
      .messages({
        'any.only': 'Type of user must be either person or business',
        'any.required': 'Type of user is required'
      }),
    
    // fk_plan_id: Joi.number().integer().positive().required()
    //   .messages({
    //     'number.base': 'Plan ID must be a number',
    //     'number.integer': 'Plan ID must be an integer',
    //     'number.positive': 'Plan ID must be positive',
    //     'any.required': 'Plan ID is required'
    //   }),
    
    plan_name: Joi.string().optional(),

    business_name: Joi.when('typeOfUser', {
      is: 'business',
      then: Joi.string()
        .min(2)
        .max(100)
        .pattern(/^[a-zA-Z\s\u0600-\u06FF]+$/)
        .required()
        .messages({
          'string.empty': 'Business name is required for business accounts',
          'string.min': 'Business name should have at least 2 characters',
          'string.max': 'Business name should not exceed 100 characters',
          'string.pattern.base': 'Business name must contain only letters and spaces (Arabic and English)'
        }),
      otherwise: Joi.string().optional().allow('', null)
    }),
    
    business_sector: Joi.when('typeOfUser', {
      is: 'business',
      then: Joi.string()
        .max(100)
        .pattern(/^[a-zA-Z\s\u0600-\u06FF]+$/)
        .optional()
        .messages({
          'string.max': 'Business sector should not exceed 100 characters',
          'string.pattern.base': 'Business sector must contain only letters and spaces (Arabic and English)'
        }),
      otherwise: Joi.string().optional().allow('', null)
    }),
    
    password: Joi.string()
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[#@$!%*?&])[A-Za-z\\d#@$!%*?&]{8,}$'))
      .required()
      .messages({
        'string.empty': 'Password is required',
        'string.pattern.base': 'Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character (#@$!%*?&)'
      }),
    
    phone: Joi.string()
      .pattern(/^(\+20|0020|20)?(01[0-9]{9})$/)
      .required()
      .messages({
        'string.empty': 'Phone number is required',
        'string.pattern.base': 'Please provide a valid Egyptian phone number (e.g., +201234567890, 01234567890)'
      })
  }).options({ abortEarly: false });

  const { error, value } = schema.validate(req.body);

  if (error) {
    const errorMessages = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      message: 'Validation failed',
      errors: errorMessages
    });
  }

  req.validatedUser = value;
  next();
};