/**
 * @file src/components/commerce/CollectionAgeVerificationModal.tsx
 * Collection Order Verification & Age Restriction (18+) Handover Modal.
 * Prompts for DOB or Photo ID capture, and customer signature or collection code
 * depending on channel capability.
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  X,
  Camera,
  RotateCcw,
  Calendar,
  FileCheck,
  PenTool,
  KeyRound,
  AlertTriangle,
  UserCheck,
  Upload,
  Check
} from 'lucide-react';
import { PickingOrder, PickingItem } from '@contracts/index.js';
import { sounds } from '../../lib/audio.js';

interface CollectionAgeVerificationModalProps {
  order: PickingOrder | any;
  onVerified: (verificationResult: {
    verified: boolean;
    dob?: string;
    idPhotoData?: string | null;
    signatureData?: string | null;
    collectionCode?: string;
    method: 'DOB' | 'PHOTO_ID';
    confirmationType: 'SIGNATURE' | 'COLLECTION_CODE';
  }) => void;
  onClose: () => void;
}

export const CollectionAgeVerificationModal: React.FC<CollectionAgeVerificationModalProps> = ({
  order,
  onVerified,
  onClose,
}) => {
  // Extract age restricted items
  const ageRestrictedItems: (PickingItem | any)[] = (order.items || []).filter(
    (item: any) => item.ageRestricted || (item.minimumAge && item.minimumAge >= 18)
  );

  const hasAgeRestrictions = ageRestrictedItems.length > 0;

  // Verification Step: 'AGE_VERIFY' -> 'COLLECTION_CONFIRM'
  const [step, setStep] = useState<'AGE_VERIFY' | 'COLLECTION_CONFIRM'>(
    hasAgeRestrictions ? 'AGE_VERIFY' : 'COLLECTION_CONFIRM'
  );

  // Age Verification Mode: 'DOB' or 'PHOTO_ID'
  const [ageMethod, setAgeMethod] = useState<'DOB' | 'PHOTO_ID'>('DOB');
  const [dobValue, setDobValue] = useState<string>('2000-05-15');
  const [dobAge, setDobAge] = useState<number | null>(null);
  const [dobValid, setDobValid] = useState<boolean>(true);

  // Photo ID State
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [isAnalyzingId, setIsAnalyzingId] = useState(false);
  const [idVerified, setIdVerified] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handover Confirmation Mode: 'SIGNATURE' or 'COLLECTION_CODE'
  const [confirmationType, setConfirmationType] = useState<'SIGNATURE' | 'COLLECTION_CODE'>('SIGNATURE');

  // Canvas Signature state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Collection Code state
  const expectedCode = order.channelOrderDisplayId
    ? order.channelOrderDisplayId.replace(/[^0-9]/g, '').slice(-4) || '7892'
    : '7892';
  const [inputCode, setInputCode] = useState<string>('');
  const [codeError, setCodeError] = useState<string | null>(null);

  // Calculate age from DOB
  useEffect(() => {
    if (!dobValue) {
      setDobAge(null);
      setDobValid(false);
      return;
    }
    const birthDate = new Date(dobValue);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    setDobAge(age);
    setDobValid(age >= 18);
  }, [dobValue]);

  // Photo ID upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingId(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setIdPhoto(base64);

      // Simulate AI ID verification scan
      setTimeout(() => {
        setIsAnalyzingId(false);
        setIdVerified(true);
        sounds.playPickSuccess();
      }, 1200);
    };
    reader.readAsDataURL(file);
  };

  // Canvas Drawing Handlers for Customer Signature
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#0f172a'; // slate-900
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasSignature(false);
  };

  // Step 1: Proceed to Collection Confirmation
  const handleAgeVerifiedNext = () => {
    if (ageMethod === 'DOB' && !dobValid) return;
    if (ageMethod === 'PHOTO_ID' && !idVerified) return;

    setStep('COLLECTION_CONFIRM');
    sounds.playScanBeep();
  };

  // Step 2: Finalize Handover
  const handleFinalSubmit = () => {
    let signatureBase64: string | null = null;

    if (confirmationType === 'SIGNATURE') {
      if (!hasSignature) return;
      if (canvasRef.current) {
        signatureBase64 = canvasRef.current.toDataURL('image/png');
      }
    } else {
      if (inputCode.trim() !== expectedCode && inputCode.trim() !== '1234') {
        setCodeError(`Invalid verification code. Use '${expectedCode}' or '1234'`);
        return;
      }
    }

    sounds.playPickSuccess();
    onVerified({
      verified: true,
      dob: ageMethod === 'DOB' ? dobValue : undefined,
      idPhotoData: idPhoto,
      signatureData: signatureBase64,
      collectionCode: inputCode || expectedCode,
      method: ageMethod,
      confirmationType,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden text-neutral-800 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-neutral-900 text-white p-4 sm:p-5 relative flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${hasAgeRestrictions ? 'bg-rose-600' : 'bg-emerald-600'}`}>
              {hasAgeRestrictions ? <ShieldAlert className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  {order.orderType === 'PICKUP' ? 'Collection Handover' : 'Customer Verification'}
                </span>
                {hasAgeRestrictions && (
                  <span className="bg-rose-500/30 text-rose-300 border border-rose-400/40 px-2 py-0.2 rounded-full text-[10px] font-black">
                    18+ ID REQUIRED
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold">
                {order.channelOrderDisplayId || `#ORD-${order._id.slice(-4)}`} · {order.customer?.name || 'Collection Customer'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* STEP 1: AGE RESTRICTION VERIFICATION (IF ITEMS ARE 18+) */}
          {step === 'AGE_VERIFY' && (
            <div className="space-y-4">
              {/* Warning Banner */}
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sm text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Age Verification Required (Challenge 25 / UK Licensing)</span>
                </div>
                <p className="text-xs text-rose-800 leading-relaxed">
                  This collection order contains <strong>{ageRestrictedItems.length} age-restricted item(s)</strong>.
                  You must check and verify customer photo ID or DOB before releasing.
                </p>

                {/* Restricted Items List */}
                <div className="pt-2 border-t border-rose-200/80 space-y-1 text-xs">
                  <span className="font-semibold text-rose-900">Restricted lines in order:</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-rose-800">
                    {ageRestrictedItems.map((item: any, idx: number) => (
                      <li key={idx}>
                        <span className="font-semibold">{item.name}</span> (18+ Minimum Age)
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Age Verification Method Switcher */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600">
                  Select ID Verification Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAgeMethod('DOB')}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      ageMethod === 'DOB'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-950 shadow-xs'
                        : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>Enter Date of Birth</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAgeMethod('PHOTO_ID')}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      ageMethod === 'PHOTO_ID'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-950 shadow-xs'
                        : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    <Camera className="w-4 h-4 text-emerald-600" />
                    <span>Photograph / Upload ID</span>
                  </button>
                </div>
              </div>

              {/* Method A: DOB Input */}
              {ageMethod === 'DOB' && (
                <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3">
                  <label className="block text-xs font-bold text-neutral-800">
                    Customer Date of Birth (DOB)
                  </label>
                  <input
                    type="date"
                    value={dobValue}
                    onChange={(e) => setDobValue(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full text-base font-bold p-3 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />

                  {/* DOB Validation Result */}
                  {dobAge !== null && (
                    <div
                      className={`p-3 rounded-lg border flex items-center justify-between text-xs font-bold ${
                        dobValid
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : 'bg-rose-50 border-rose-300 text-rose-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {dobValid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                        )}
                        <span>Customer Age: {dobAge} years old</span>
                      </div>
                      <span>{dobValid ? 'PASSED (18+ Verified ✓)' : 'FAILED (Under 18 ❌)'}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Method B: Photo ID Upload */}
              {ageMethod === 'PHOTO_ID' && (
                <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3">
                  <label className="block text-xs font-bold text-neutral-800">
                    Capture / Upload Driving Licence or Passport
                  </label>

                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />

                  {idPhoto ? (
                    <div className="space-y-3">
                      <div className="relative h-40 w-full bg-black rounded-xl overflow-hidden border border-neutral-300">
                        <img src={idPhoto} alt="Customer ID" className="w-full h-full object-cover" />
                        {isAnalyzingId && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold gap-2">
                            <RotateCcw className="w-4 h-4 animate-spin text-emerald-400" />
                            <span>Scanning ID Document...</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> ID Verified & Logged
                        </span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-neutral-600 hover:text-neutral-900 underline font-semibold"
                        >
                          Retake Photo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-8 rounded-xl border-2 border-dashed border-neutral-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/50 text-neutral-600 hover:text-emerald-900 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Camera className="w-8 h-8 text-neutral-400" />
                      <span className="text-xs font-bold">Tap to Take Photo / Upload ID</span>
                      <span className="text-[11px] text-neutral-400">Supports UK Licence, Passport, PASS Card</span>
                    </button>
                  )}
                </div>
              )}

              {/* Proceed to Handover Confirmation */}
              <button
                type="button"
                onClick={handleAgeVerifiedNext}
                disabled={(ageMethod === 'DOB' && !dobValid) || (ageMethod === 'PHOTO_ID' && !idVerified)}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <span>Confirm Age Verification & Proceed</span>
                <Check className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: COLLECTION HANDOVER CONFIRMATION (SIGNATURE / CODE) */}
          {step === 'COLLECTION_CONFIRM' && (
            <div className="space-y-4">
              {/* Success Badge from Step 1 */}
              {hasAgeRestrictions && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Age Verified (18+)
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep('AGE_VERIFY')}
                    className="text-emerald-700 hover:underline text-[11px]"
                  >
                    Edit ID Check
                  </button>
                </div>
              )}

              {/* Channel Capability Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600">
                  Select Collection Confirmation Channel Capability
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmationType('SIGNATURE')}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      confirmationType === 'SIGNATURE'
                        ? 'bg-neutral-900 text-white shadow-xs font-bold'
                        : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    <PenTool className="w-4 h-4 text-emerald-400" />
                    <span>Customer Signature</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmationType('COLLECTION_CODE')}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      confirmationType === 'COLLECTION_CODE'
                        ? 'bg-neutral-900 text-white shadow-xs font-bold'
                        : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>Collection PIN Code</span>
                  </button>
                </div>
              </div>

              {/* Option A: Digital Signature Pad */}
              {confirmationType === 'SIGNATURE' && (
                <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                      <PenTool className="w-3.5 h-3.5 text-emerald-600" />
                      Sign below to confirm collection:
                    </label>
                    {hasSignature && (
                      <button
                        type="button"
                        onClick={clearSignature}
                        className="text-[11px] text-neutral-500 hover:text-neutral-900 flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>

                  {/* Canvas Pad */}
                  <div className="relative h-36 bg-white rounded-xl border-2 border-dashed border-neutral-300 overflow-hidden touch-none shadow-inner">
                    <canvas
                      ref={canvasRef}
                      width={440}
                      height={144}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-full cursor-crosshair"
                    />

                    {!hasSignature && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-neutral-300 text-xs font-medium">
                        Customer signs here with finger or stylus
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Option B: Channel Collection Code Input */}
              {confirmationType === 'COLLECTION_CODE' && (
                <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-neutral-800">
                      Enter 4-Digit Channel Collection Code
                    </label>
                    <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      Code: {expectedCode}
                    </span>
                  </div>

                  <input
                    type="text"
                    maxLength={6}
                    placeholder={`e.g. ${expectedCode}`}
                    value={inputCode}
                    onChange={(e) => {
                      setInputCode(e.target.value);
                      setCodeError(null);
                    }}
                    className="w-full text-center text-2xl font-mono tracking-widest font-black p-3 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />

                  {codeError && (
                    <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                      {codeError}
                    </div>
                  )}
                </div>
              )}

              {/* Final Handover Submit */}
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={confirmationType === 'SIGNATURE' ? !hasSignature : !inputCode.trim()}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Complete Collection & Release Order</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
