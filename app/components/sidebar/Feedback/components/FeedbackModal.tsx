import ReactModal from 'react-modal';
import { useStore } from '@nanostores/react';
import { feedbackModalState, feedbackModalStore } from '~/lib/stores/feedbackModal';
import { toast } from 'react-toastify';
import { supabaseSubmitFeedback } from '~/lib/supabase/feedback';
import { getLastChatMessages } from '~/utils/chat/messageUtils';
import { getAllAppResponses } from '~/lib/replay/ResponseFilter';
import { userStore } from '~/lib/stores/auth';
import { X, CheckCircle, MessageCircle, Send, Calendar } from '~/components/ui/Icon';

const GlobalFeedbackModal = () => {
  const { isOpen, formData, submitted } = useStore(feedbackModalState);
  const user = useStore(userStore);

  const handleSubmitFeedback = async () => {
    if (!formData.description) {
      toast.error('Please fill in the feedback field');
      return;
    }

    toast.info('Submitting feedback...');

    const feedbackData: any = {
      description: formData.description,
      share: formData.share,
      source: 'feedback_modal',
    };

    if (feedbackData.share) {
      feedbackData.chatMessages = getLastChatMessages();
      feedbackData.chatResponses = getAllAppResponses();
    }

    try {
      const success = await supabaseSubmitFeedback(feedbackData);

      if (window.analytics) {
        window.analytics.track('Submitted feedback', {
          timestamp: new Date().toISOString(),
          userId: user?.id,
          email: user?.email,
        });
      }

      if (success) {
        feedbackModalStore.setSubmitted(true);
        toast.success('Feedback submitted successfully!');
      } else {
        toast.error('Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('An error occurred while submitting feedback');
    }
  };

  return (
    <ReactModal
      isOpen={isOpen}
      onRequestClose={feedbackModalStore.close}
      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 outline-none max-w-2xl w-full mx-4"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-[1001]"
    >
      <div className="bg-bolt-elements-background-depth-1 rounded-2xl p-6 sm:p-8 border border-bolt-elements-borderColor border-opacity-50 shadow-2xl hover:shadow-3xl transition-all duration-300 backdrop-blur-sm relative">
        <button
          onClick={feedbackModalStore.close}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 w-10 h-10 sm:w-8 sm:h-8 rounded-xl bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-3 transition-all duration-200 flex items-center justify-center text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary shadow-sm hover:shadow-md hover:scale-105 group"
          title="Close"
        >
          <X className="transition-transform duration-200 group-hover:scale-110" size={18} />
        </button>

        {submitted ? (
          <>
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-rose-500/10 to-pink-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-rose-500/20 shadow-lg">
                <CheckCircle className="text-rose-500" size={32} />
              </div>
              <h2 className="text-3xl font-bold mb-4 text-bolt-elements-textHeading">Feedback Submitted</h2>
              <p className="text-bolt-elements-textSecondary text-lg bg-bolt-elements-background-depth-2 bg-opacity-30 px-4 py-2 rounded-xl inline-block border border-bolt-elements-borderColor border-opacity-30">
                Thank you for your feedback! We appreciate your input.
              </p>
            </div>
            <div className="flex justify-center">
              <button
                onClick={feedbackModalStore.close}
                className="px-6 py-3 bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary rounded-xl transition-all duration-200 font-medium shadow-sm hover:shadow-md hover:scale-105 border border-bolt-elements-borderColor group"
              >
                <span className="transition-transform duration-200 group-hover:scale-105">Close</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20 shadow-lg">
                <MessageCircle className="text-blue-500" size={32} />
              </div>
              <h2 className="text-3xl font-bold mb-4 text-bolt-elements-textHeading">Share Your Feedback</h2>
              <p className="text-bolt-elements-textSecondary text-lg">
                Let us know how Replay.Builder is doing or report any issues you've encountered.
              </p>
            </div>

            <div className="mb-6">
              <label className="block mb-3 text-sm font-semibold text-bolt-elements-textPrimary">Your Feedback:</label>
              <textarea
                name="description"
                className="w-full p-4 border rounded-xl bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary border-bolt-elements-borderColor border-opacity-50 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 min-h-[140px] transition-all duration-200 shadow-sm hover:shadow-md resize-none"
                value={formData.description}
                placeholder="Tell us what you think or describe any issues..."
                onChange={(e) => {
                  feedbackModalStore.setFormData({
                    ...formData,
                    description: e.target.value,
                  });
                }}
              />
            </div>

            <div className="flex items-center gap-3 mb-8 p-4 bg-bolt-elements-background-depth-2 bg-opacity-30 rounded-xl border border-bolt-elements-borderColor border-opacity-30">
              <input
                type="checkbox"
                id="share-project"
                name="share"
                className="w-4 h-4 bg-bolt-elements-background-depth-2 text-blue-500 rounded border-bolt-elements-borderColor focus:ring-2 focus:ring-blue-500/50 transition-colors"
                checked={formData.share}
                onChange={(e) => {
                  feedbackModalStore.setFormData({
                    ...formData,
                    share: e.target.checked,
                  });
                }}
              />
              <label htmlFor="share-project" className="text-sm text-bolt-elements-textSecondary font-medium">
                Share project with the Replay team (helps us diagnose issues)
              </label>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
              <button
                onClick={handleSubmitFeedback}
                className="px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group flex items-center justify-center gap-2"
              >
                <Send className="transition-transform duration-200 group-hover:scale-110" size={18} />
                <span className="transition-transform duration-200 group-hover:scale-105">Submit Feedback</span>
              </button>
              <button
                onClick={feedbackModalStore.close}
                className="px-6 py-3 bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary rounded-xl transition-all duration-200 font-medium shadow-sm hover:shadow-md hover:scale-105 border border-bolt-elements-borderColor group"
              >
                <span className="transition-transform duration-200 group-hover:scale-105">Cancel</span>
              </button>
            </div>

            <div className="text-center border-t border-bolt-elements-borderColor border-opacity-50 pt-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="flex-1 h-px bg-bolt-elements-borderColor/30"></div>
                <span className="text-bolt-elements-textSecondary font-medium">Or</span>
                <div className="flex-1 h-px bg-bolt-elements-borderColor/30"></div>
              </div>
              <a
                className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-600 transition-all duration-200 cursor-pointer font-semibold bg-blue-500/10 hover:bg-blue-500/20 px-4 py-2 rounded-xl border border-blue-500/20 hover:border-blue-500/30 shadow-sm hover:shadow-md hover:scale-105 group"
                href="https://cal.com/filip"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Calendar className="transition-transform duration-200 group-hover:scale-110" size={18} />
                <span className="transition-transform duration-200 group-hover:scale-105">
                  Schedule a call with the Replay Team
                </span>
              </a>
            </div>
          </>
        )}
      </div>
    </ReactModal>
  );
};

export default GlobalFeedbackModal;
