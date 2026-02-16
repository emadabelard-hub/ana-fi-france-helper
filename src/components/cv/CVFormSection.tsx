import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, User, Briefcase, GraduationCap, Languages, Wrench, Car, Heart, Camera, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CVData, Experience, Education, Language } from '@/pages/CVGeneratorPage';

interface CVFormSectionProps {
  cvData: CVData;
  onChange: (data: CVData) => void;
  isRTL: boolean;
}

const CVFormSection = ({ cvData, onChange, isRTL }: CVFormSectionProps) => {
  const [newSkill, setNewSkill] = useState('');
  const [newInterest, setNewInterest] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [photoError, setPhotoError] = useState('');

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Only accept JPG/JPEG
    if (file.type !== 'image/jpeg') {
      setPhotoError(isRTL 
        ? 'صيغة الصورة غير مقبولة. يرجى استيراد صورة بصيغة JPG.' 
        : 'Format d\'image non pris en compte. Veuillez importer une image JPG.');
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }
    
    setPhotoError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      updateField('photoUrl', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    updateField('photoUrl', undefined);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const updateField = (field: keyof CVData, value: any) => {
    onChange({ ...cvData, [field]: value });
  };

  const addExperience = () => {
    const newExp: Experience = {
      id: crypto.randomUUID(),
      company: '',
      position: '',
      startDate: '',
      endDate: '',
      description: '',
    };
    updateField('experiences', [...cvData.experiences, newExp]);
  };

  const updateExperience = (id: string, field: keyof Experience, value: string) => {
    const updated = cvData.experiences.map(exp =>
      exp.id === id ? { ...exp, [field]: value } : exp
    );
    updateField('experiences', updated);
  };

  const removeExperience = (id: string) => {
    updateField('experiences', cvData.experiences.filter(exp => exp.id !== id));
  };

  const addEducation = () => {
    const newEdu: Education = {
      id: crypto.randomUUID(),
      institution: '',
      degree: '',
      field: '',
      startDate: '',
      endDate: '',
    };
    updateField('education', [...cvData.education, newEdu]);
  };

  const updateEducation = (id: string, field: keyof Education, value: string) => {
    const updated = cvData.education.map(edu =>
      edu.id === id ? { ...edu, [field]: value } : edu
    );
    updateField('education', updated);
  };

  const removeEducation = (id: string) => {
    updateField('education', cvData.education.filter(edu => edu.id !== id));
  };

  const addSkill = () => {
    if (newSkill.trim() && !cvData.skills.includes(newSkill.trim())) {
      updateField('skills', [...cvData.skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    updateField('skills', cvData.skills.filter(s => s !== skill));
  };

  const addInterest = () => {
    if (newInterest.trim() && !cvData.interests.includes(newInterest.trim())) {
      updateField('interests', [...cvData.interests, newInterest.trim()]);
      setNewInterest('');
    }
  };

  const removeInterest = (interest: string) => {
    updateField('interests', cvData.interests.filter(i => i !== interest));
  };

  const addLanguage = () => {
    const newLang: Language = {
      id: crypto.randomUUID(),
      name: '',
      level: 'intermediaire',
    };
    updateField('languages', [...cvData.languages, newLang]);
  };

  const updateLanguage = (id: string, field: keyof Language, value: string) => {
    const updated = cvData.languages.map(lang =>
      lang.id === id ? { ...lang, [field]: value } : lang
    );
    updateField('languages', updated);
  };

  const removeLanguage = (id: string) => {
    updateField('languages', cvData.languages.filter(lang => lang.id !== id));
  };

  const languageLevels = [
    { value: 'debutant', label: isRTL ? 'مبتدئ' : 'Débutant' },
    { value: 'intermediaire', label: isRTL ? 'متوسط' : 'Intermédiaire' },
    { value: 'avance', label: isRTL ? 'متقدم' : 'Avancé' },
    { value: 'bilingue', label: isRTL ? 'ثنائي اللغة' : 'Bilingue' },
    { value: 'natif', label: isRTL ? 'لغة أم' : 'Langue maternelle' },
  ];

  return (
    <div className="space-y-4">
      {/* Personal Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn("flex items-center gap-2 text-lg", isRTL && "flex-row-reverse font-cairo")}>
            <User className="h-5 w-5 text-indigo-500" />
            {isRTL ? 'المعلومات الشخصية' : 'Informations personnelles'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className={cn(isRTL && "font-cairo text-right block")}>
                {isRTL ? 'الاسم الكامل' : 'Nom complet'}
              </Label>
              <Input
                value={cvData.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                placeholder={isRTL ? 'محمد أحمد' : 'Mohamed Ahmed'}
                dir={isRTL ? 'rtl' : 'ltr'}
                className={cn(isRTL && "text-right font-cairo")}
              />
            </div>
            <div>
              <Label className={cn(isRTL && "font-cairo text-right block")}>
                {isRTL ? 'المهنة' : 'Métier'}
              </Label>
              <Input
                value={cvData.profession}
                onChange={(e) => updateField('profession', e.target.value)}
                placeholder={isRTL ? 'مثال: مهندس - محاسب - مطور - طالب' : 'Ex: Ingénieur - Comptable - Développeur - Étudiant'}
                dir={isRTL ? 'rtl' : 'ltr'}
                className={cn(isRTL && "text-right font-cairo")}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className={cn(isRTL && "font-cairo text-right block")}>
                {isRTL ? 'البريد الإلكتروني' : 'Email'}
              </Label>
              <Input
                type="email"
                value={cvData.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="email@example.com"
                dir="ltr"
              />
            </div>
            <div>
              <Label className={cn(isRTL && "font-cairo text-right block")}>
                {isRTL ? 'الهاتف' : 'Téléphone'}
              </Label>
              <Input
                value={cvData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+33 6 XX XX XX XX"
                dir="ltr"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className={cn(isRTL && "font-cairo text-right block")}>
                {isRTL ? 'تاريخ الميلاد' : 'Date de naissance'}
              </Label>
              <Input
                value={cvData.birthDate}
                onChange={(e) => updateField('birthDate', e.target.value)}
                placeholder={isRTL ? '١٥/٠٣/١٩٨٥' : '15/03/1985'}
                dir="ltr"
              />
            </div>
            <div>
              <Label className={cn(isRTL && "font-cairo text-right block")}>
                {isRTL ? 'العنوان الكامل' : 'Adresse complète'}
              </Label>
              <Input
                value={cvData.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder={isRTL ? '١٢ شارع الجمهورية، ٧٥٠١٠ باريس' : '12 rue de la République, 75010 Paris'}
                dir={isRTL ? 'rtl' : 'ltr'}
                className={cn(isRTL && "text-right font-cairo")}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className={cn(isRTL && "font-cairo text-right block")}>
                {isRTL ? 'الحالة العائلية' : 'Situation familiale'}
              </Label>
              <Input
                value={cvData.maritalStatus}
                onChange={(e) => updateField('maritalStatus', e.target.value)}
                placeholder={isRTL ? 'أعزب، متزوج...' : 'Célibataire, Marié(e)...'}
                dir={isRTL ? 'rtl' : 'ltr'}
                className={cn(isRTL && "text-right font-cairo")}
              />
            </div>
            <div>
              <Label className={cn(isRTL && "font-cairo text-right block")}>
                {isRTL ? 'نوع الرخصة' : 'Permis de conduire'}
              </Label>
              <Input
                value={cvData.drivingLicense}
                onChange={(e) => updateField('drivingLicense', e.target.value)}
                placeholder={isRTL ? 'B, A2, Moto...' : 'B, A2, Moto...'}
                dir="ltr"
              />
            </div>
          </div>
          {/* Photo upload - optional */}
          <div>
            <Label className={cn(isRTL && "font-cairo text-right block")}>
              {isRTL ? 'صورة شخصية (اختياري)' : 'Photo (facultatif)'}
            </Label>
            <div className="flex items-center gap-3 mt-1">
              {cvData.photoUrl ? (
                <div className="relative">
                  <img
                    src={cvData.photoUrl}
                    alt="Photo CV"
                    className="w-16 h-16 rounded-full object-cover border border-border"
                  />
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => photoInputRef.current?.click()}
                  className="gap-2"
                >
                  <Camera className="h-4 w-4" />
                  {isRTL ? 'اختر صورة' : 'Choisir une photo'}
                </Button>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
            {photoError && (
              <p className="text-sm text-destructive mt-1">{photoError}</p>
            )}
          </div>
          <div>
            <Label className={cn(isRTL && "font-cairo text-right block")}>
              {isRTL ? 'نبذة مختصرة' : 'Résumé professionnel'}
            </Label>
            <Textarea
              value={cvData.summary}
              onChange={(e) => updateField('summary', e.target.value)}
              placeholder={isRTL 
                ? 'اكتب نبذة قصيرة عن خبرتك ومهاراتك...' 
                : 'Décrivez brièvement votre expérience et vos compétences...'}
              dir={isRTL ? 'rtl' : 'ltr'}
              className={cn("min-h-[80px]", isRTL && "text-right font-cairo")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Experiences */}
      <Card>
        <CardHeader className="pb-3">
          <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
            <CardTitle className={cn("flex items-center gap-2 text-lg", isRTL && "flex-row-reverse font-cairo")}>
              <Briefcase className="h-5 w-5 text-emerald-500" />
              {isRTL ? 'الخبرات المهنية' : 'Expériences professionnelles'}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addExperience} className="gap-1">
              <Plus className="h-4 w-4" />
              {isRTL ? 'إضافة' : 'Ajouter'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {cvData.experiences.map((exp, index) => (
            <div key={exp.id} className="border rounded-lg p-3 space-y-3 relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeExperience(exp.id)}
                className="absolute top-2 right-2 h-7 w-7 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-8">
                <div>
                  <Label className={cn(isRTL && "font-cairo text-right block")}>
                    {isRTL ? 'الشركة' : 'Entreprise'}
                  </Label>
                  <Input
                    value={exp.company}
                    onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                    placeholder={isRTL ? 'اسم الشركة' : 'Nom de l\'entreprise'}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    className={cn(isRTL && "text-right font-cairo")}
                  />
                </div>
                <div>
                  <Label className={cn(isRTL && "font-cairo text-right block")}>
                    {isRTL ? 'المنصب' : 'Poste'}
                  </Label>
                  <Input
                    value={exp.position}
                    onChange={(e) => updateExperience(exp.id, 'position', e.target.value)}
                    placeholder={isRTL ? 'المسمى الوظيفي' : 'Titre du poste'}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    className={cn(isRTL && "text-right font-cairo")}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={cn(isRTL && "font-cairo text-right block")}>
                    {isRTL ? 'من' : 'De'}
                  </Label>
                  <Input
                    value={exp.startDate}
                    onChange={(e) => updateExperience(exp.id, 'startDate', e.target.value)}
                    placeholder="2020"
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label className={cn(isRTL && "font-cairo text-right block")}>
                    {isRTL ? 'إلى' : 'À'}
                  </Label>
                  <Input
                    value={exp.endDate}
                    onChange={(e) => updateExperience(exp.id, 'endDate', e.target.value)}
                    placeholder={isRTL ? 'الحالي' : 'Présent'}
                    dir="ltr"
                  />
                </div>
              </div>
              <div>
                <Label className={cn(isRTL && "font-cairo text-right block")}>
                  {isRTL ? 'الوصف' : 'Description'}
                </Label>
                <Textarea
                  value={exp.description}
                  onChange={(e) => updateExperience(exp.id, 'description', e.target.value)}
                  placeholder={isRTL ? 'صف مهامك ومسؤولياتك...' : 'Décrivez vos tâches et responsabilités...'}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  className={cn("min-h-[60px]", isRTL && "text-right font-cairo")}
                />
              </div>
            </div>
          ))}
          {cvData.experiences.length === 0 && (
            <p className={cn("text-sm text-muted-foreground text-center py-4", isRTL && "font-cairo")}>
              {isRTL ? 'لم تضف أي خبرة بعد' : 'Aucune expérience ajoutée'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardHeader className="pb-3">
          <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
            <CardTitle className={cn("flex items-center gap-2 text-lg", isRTL && "flex-row-reverse font-cairo")}>
              <GraduationCap className="h-5 w-5 text-amber-500" />
              {isRTL ? 'التعليم' : 'Formation'}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addEducation} className="gap-1">
              <Plus className="h-4 w-4" />
              {isRTL ? 'إضافة' : 'Ajouter'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {cvData.education.map((edu) => (
            <div key={edu.id} className="border rounded-lg p-3 space-y-3 relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeEducation(edu.id)}
                className="absolute top-2 right-2 h-7 w-7 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-8">
                <div>
                  <Label className={cn(isRTL && "font-cairo text-right block")}>
                    {isRTL ? 'المؤسسة' : 'Établissement'}
                  </Label>
                  <Input
                    value={edu.institution}
                    onChange={(e) => updateEducation(edu.id, 'institution', e.target.value)}
                    placeholder={isRTL ? 'اسم المعهد أو الجامعة' : 'Nom de l\'établissement'}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    className={cn(isRTL && "text-right font-cairo")}
                  />
                </div>
                <div>
                  <Label className={cn(isRTL && "font-cairo text-right block")}>
                    {isRTL ? 'الشهادة' : 'Diplôme'}
                  </Label>
                  <Input
                    value={edu.degree}
                    onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                    placeholder={isRTL ? 'نوع الشهادة' : 'Type de diplôme'}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    className={cn(isRTL && "text-right font-cairo")}
                  />
                </div>
              </div>
              <div>
                <Label className={cn(isRTL && "font-cairo text-right block")}>
                  {isRTL ? 'التخصص' : 'Spécialité'}
                </Label>
                <Input
                  value={edu.field}
                  onChange={(e) => updateEducation(edu.id, 'field', e.target.value)}
                  placeholder={isRTL ? 'مجال الدراسة' : 'Domaine d\'études'}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  className={cn(isRTL && "text-right font-cairo")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={cn(isRTL && "font-cairo text-right block")}>
                    {isRTL ? 'من' : 'De'}
                  </Label>
                  <Input
                    value={edu.startDate}
                    onChange={(e) => updateEducation(edu.id, 'startDate', e.target.value)}
                    placeholder="2018"
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label className={cn(isRTL && "font-cairo text-right block")}>
                    {isRTL ? 'إلى' : 'À'}
                  </Label>
                  <Input
                    value={edu.endDate}
                    onChange={(e) => updateEducation(edu.id, 'endDate', e.target.value)}
                    placeholder="2020"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          ))}
          {cvData.education.length === 0 && (
            <p className={cn("text-sm text-muted-foreground text-center py-4", isRTL && "font-cairo")}>
              {isRTL ? 'لم تضف أي تعليم بعد' : 'Aucune formation ajoutée'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn("flex items-center gap-2 text-lg", isRTL && "flex-row-reverse font-cairo")}>
            <Wrench className="h-5 w-5 text-blue-500" />
            {isRTL ? 'المهارات' : 'Compétences'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
            <Input
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder={isRTL ? 'أضف مهارة جديدة' : 'Ajouter une compétence'}
              dir={isRTL ? 'rtl' : 'ltr'}
              className={cn("flex-1", isRTL && "text-right font-cairo")}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
            />
            <Button onClick={addSkill} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {cvData.skills.map((skill) => (
              <Badge 
                key={skill} 
                variant="secondary"
                className="gap-1 pr-1 cursor-pointer hover:bg-destructive/20"
                onClick={() => removeSkill(skill)}
              >
                {skill}
                <Trash2 className="h-3 w-3" />
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Languages */}
      <Card>
        <CardHeader className="pb-3">
          <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
            <CardTitle className={cn("flex items-center gap-2 text-lg", isRTL && "flex-row-reverse font-cairo")}>
              <Languages className="h-5 w-5 text-purple-500" />
              {isRTL ? 'اللغات' : 'Langues'}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addLanguage} className="gap-1">
              <Plus className="h-4 w-4" />
              {isRTL ? 'إضافة' : 'Ajouter'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {cvData.languages.map((lang) => (
            <div key={lang.id} className={cn("flex gap-2 items-end", isRTL && "flex-row-reverse")}>
              <div className="flex-1">
                <Label className={cn(isRTL && "font-cairo text-right block")}>
                  {isRTL ? 'اللغة' : 'Langue'}
                </Label>
                <Input
                  value={lang.name}
                  onChange={(e) => updateLanguage(lang.id, 'name', e.target.value)}
                  placeholder={isRTL ? 'العربية' : 'Arabe'}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  className={cn(isRTL && "text-right font-cairo")}
                />
              </div>
              <div className="flex-1">
                <Label className={cn(isRTL && "font-cairo text-right block")}>
                  {isRTL ? 'المستوى' : 'Niveau'}
                </Label>
                <Select 
                  value={lang.level} 
                  onValueChange={(value) => updateLanguage(lang.id, 'level', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languageLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeLanguage(lang.id)}
                className="text-destructive hover:text-destructive shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {cvData.languages.length === 0 && (
            <p className={cn("text-sm text-muted-foreground text-center py-4", isRTL && "font-cairo")}>
              {isRTL ? 'لم تضف أي لغة بعد' : 'Aucune langue ajoutée'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Centres d'intérêt */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn("flex items-center gap-2 text-lg", isRTL && "flex-row-reverse font-cairo")}>
            <Heart className="h-5 w-5 text-rose-500" />
            {isRTL ? 'اهتماماتك' : 'Centres d\'intérêt'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
            <Input
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              placeholder={isRTL ? 'أضف اهتمام جديد' : 'Ajouter un centre d\'intérêt'}
              dir={isRTL ? 'rtl' : 'ltr'}
              className={cn("flex-1", isRTL && "text-right font-cairo")}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())}
            />
            <Button onClick={addInterest} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {cvData.interests.map((interest) => (
              <Badge 
                key={interest} 
                variant="secondary"
                className="gap-1 pr-1 cursor-pointer hover:bg-destructive/20"
                onClick={() => removeInterest(interest)}
              >
                {interest}
                <Trash2 className="h-3 w-3" />
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CVFormSection;
